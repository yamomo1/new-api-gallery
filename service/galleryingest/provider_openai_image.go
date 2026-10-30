package galleryingest

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// openAIImageProvider 任何 OpenAI 兼容的 /v1/images/generations 上游
// （硅基流动 SiliconFlow、302.AI、自建 SD-WebUI-Forge、one-api 系转发等都符合）
//
// 好处是这类上游不用写任何签名逻辑，new-api 现有的 OpenAI 渠道本身就能转发。
type openAIImageProvider struct{}

func (p *openAIImageProvider) Name() string { return "openai_image" }

func (p *openAIImageProvider) Submit(ctx context.Context, req GenerateRequest) (string, []Artifact, error) {
	base := strings.TrimRight(opt("GalleryIngestOpenAIBaseURL", "https://api.siliconflow.cn"), "/")
	apiKey := opt("GalleryIngestOpenAIApiKey", "")
	if apiKey == "" {
		return "", nil, errors.New("未配置 GalleryIngestOpenAIApiKey")
	}
	model := strings.TrimSpace(req.Model)
	if model == "" {
		model = opt("GalleryIngestOpenAIModel", "Kwai-Kolors/Kolors")
	}
	size := strings.TrimSpace(req.Size)
	if size == "" {
		size = opt("GalleryIngestOpenAISize", "1024x1024")
	}

	payload := map[string]any{
		"model":  model,
		"prompt": req.Prompt,
		"n":      1,
		"size":   size,
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return "", nil, err
	}
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, base+"/v1/images/generations", bytes.NewReader(body))
	if err != nil {
		return "", nil, err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+apiKey)

	client := &http.Client{Timeout: 180 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		return "", nil, err
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(io.LimitReader(resp.Body, 16<<20))
	if err != nil {
		return "", nil, err
	}
	if resp.StatusCode != http.StatusOK {
		return "", nil, fmt.Errorf("生图接口返回 HTTP %d: %s", resp.StatusCode, truncate(string(raw), 300))
	}

	var out struct {
		Data []struct {
			Url     string `json:"url"`
			B64Json string `json:"b64_json"`
		} `json:"data"`
		Error *struct {
			Message string `json:"message"`
		} `json:"error"`
	}
	if err := json.Unmarshal(raw, &out); err != nil {
		return "", nil, fmt.Errorf("解析生图结果失败: %s", truncate(string(raw), 200))
	}
	if out.Error != nil && out.Error.Message != "" {
		return "", nil, errors.New("生图失败: " + out.Error.Message)
	}
	artifacts := make([]Artifact, 0, len(out.Data))
	for _, d := range out.Data {
		switch {
		case d.Url != "":
			artifacts = append(artifacts, Artifact{URL: d.Url, Type: normalizeMediaType("", d.Url)})
		case d.B64Json != "":
			// 用 b64: 前缀把内联图片传给 runner 解码上传
			artifacts = append(artifacts, Artifact{URL: "b64:" + d.B64Json, Type: "image"})
		}
	}
	if len(artifacts) == 0 {
		return "", nil, errors.New("生图接口未返回任何图片")
	}
	return "", artifacts, nil
}

// Poll 同步型 provider 不需要轮询
func (p *openAIImageProvider) Poll(ctx context.Context, taskID string) (bool, []Artifact, error) {
	return false, nil, errors.New("openai_image 为同步上游，无需轮询")
}
