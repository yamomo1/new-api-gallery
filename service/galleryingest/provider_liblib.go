package galleryingest

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha1"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
)

// liblibProvider LiblibAI 星流开放平台适配器
//
// 鉴权：每次请求带 AccessKey / Signature / Timestamp / SignatureNonce，
// 签名 = base64url(hmacSha1(uri + "&" + timestamp + "&" + nonce, SecretKey))，去掉尾部 '='。
// 时钟偏差超过 300 秒会被静默拒绝，部署机必须保持 NTP 同步。
//
// 提交：POST /api/generate/webui/text2img
// 轮询：POST /api/generate/webui/status   → data.generateStatus 3=成功 4=失败 5=超时
const liblibBase = "https://openapi.liblibai.cloud"

// liblibSign 生成带签名的 query string
func liblibSign(uri, accessKey, secretKey string) string {
	ts := strconv.FormatInt(time.Now().UnixMilli(), 10)
	nonce := strings.ReplaceAll(uuid.NewString(), "-", "")
	content := uri + "&" + ts + "&" + nonce
	mac := hmac.New(sha1.New, []byte(secretKey))
	mac.Write([]byte(content))
	sig := base64.URLEncoding.WithPadding(base64.NoPadding).EncodeToString(mac.Sum(nil))
	return fmt.Sprintf("AccessKey=%s&Signature=%s&Timestamp=%s&SignatureNonce=%s",
		accessKey, sig, ts, nonce)
}

type liblibProvider struct{}

func (p *liblibProvider) Name() string { return "liblib" }

type liblibEnvelope struct {
	Code int             `json:"code"`
	Msg  string          `json:"msg"`
	Data json.RawMessage `json:"data"`
}

func liblibPost(ctx context.Context, uri string, payload any) (*liblibEnvelope, error) {
	ak := opt("GalleryIngestLiblibAccessKey", "")
	sk := opt("GalleryIngestLiblibSecretKey", "")
	if ak == "" || sk == "" {
		return nil, errors.New("未配置 Liblib AccessKey / SecretKey")
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	url := liblibBase + uri + "?" + liblibSign(uri, ak, sk)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(io.LimitReader(resp.Body, 8<<20))
	if err != nil {
		return nil, err
	}
	var env liblibEnvelope
	if err := json.Unmarshal(raw, &env); err != nil {
		return nil, fmt.Errorf("Liblib 返回非 JSON（HTTP %d）: %s", resp.StatusCode, truncate(string(raw), 200))
	}
	return &env, nil
}

func (p *liblibProvider) Submit(ctx context.Context, req GenerateRequest) (string, []Artifact, error) {
	// checkPointId 通过 Model 字段传入（Liblib 的模型标识是 32 位 hex，如 ba34a22f...）
	model := strings.TrimSpace(req.Model)
	if model == "" {
		return "", nil, errors.New("Liblib 需要指定模型（checkPointId）")
	}
	width, height := parseSize(opt("GalleryIngestLiblibSize", "1024x1024"))
	params := map[string]any{
		"checkPointId": model,
		"prompt":       req.Prompt,
		"width":        width,
		"height":       height,
		"imgCount":     1,
		"steps":        25,
		"sampler":      15,
		"cfgScale":     7,
		"randnSource":  0,
		"seed":         -1,
		"restoreFaces": 0,
	}
	templateUuid := opt("GalleryIngestLiblibTemplateUUID", "")
	payload := map[string]any{
		"generateParams": params,
	}
	if templateUuid != "" {
		payload["templateUuid"] = templateUuid
	}

	env, err := liblibPost(ctx, "/api/generate/webui/text2img", payload)
	if err != nil {
		return "", nil, err
	}
	if env.Code != 0 {
		return "", nil, fmt.Errorf("Liblib 提交失败 [%d] %s", env.Code, env.Msg)
	}
	var data struct {
		GenerateUuid string `json:"generateUuid"`
	}
	if err := json.Unmarshal(env.Data, &data); err != nil {
		return "", nil, fmt.Errorf("解析 Liblib 提交结果失败: %w", err)
	}
	if data.GenerateUuid == "" {
		return "", nil, errors.New("Liblib 未返回 generateUuid")
	}
	return data.GenerateUuid, nil, nil
}

func (p *liblibProvider) Poll(ctx context.Context, taskID string) (bool, []Artifact, error) {
	env, err := liblibPost(ctx, "/api/generate/webui/status", map[string]any{
		"generateUuid": taskID,
	})
	if err != nil {
		return false, nil, err
	}
	if env.Code != 0 {
		return false, nil, fmt.Errorf("Liblib 状态查询失败 [%d] %s", env.Code, env.Msg)
	}
	var data struct {
		GenerateStatus int `json:"generateStatus"`
		Percent        int `json:"percentCompleted"`
		Images         []struct {
			ImageUrl string `json:"imageUrl"`
		} `json:"images"`
	}
	if err := json.Unmarshal(env.Data, &data); err != nil {
		return false, nil, fmt.Errorf("解析 Liblib 状态失败: %w", err)
	}
	switch data.GenerateStatus {
	case 3: // 成功
	case 4:
		return false, nil, errors.New("Liblib 生成失败")
	case 5:
		return false, nil, errors.New("Liblib 生成超时")
	default:
		return false, nil, nil
	}
	artifacts := make([]Artifact, 0, len(data.Images))
	for _, img := range data.Images {
		if img.ImageUrl != "" {
			artifacts = append(artifacts, Artifact{URL: img.ImageUrl, Type: "image"})
		}
	}
	if len(artifacts) == 0 {
		return false, nil, errors.New("Liblib 任务成功但没有产物")
	}
	return true, artifacts, nil
}

// parseSize 解析 "1024x768" 形式的尺寸
func parseSize(s string) (int, int) {
	parts := strings.Split(strings.ToLower(strings.TrimSpace(s)), "x")
	if len(parts) != 2 {
		return 1024, 1024
	}
	w, err1 := strconv.Atoi(strings.TrimSpace(parts[0]))
	h, err2 := strconv.Atoi(strings.TrimSpace(parts[1]))
	if err1 != nil || err2 != nil || w <= 0 || h <= 0 {
		return 1024, 1024
	}
	return w, h
}
