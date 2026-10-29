package storage

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha1"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"strings"
	"time"
)

// QiniuProvider 通过七牛上传 API 直传（upload token = HMAC-SHA1 签名），不依赖官方 SDK。
// 上传地址按机房选择，默认华南 z2。
type QiniuProvider struct {
	Bucket     string
	AccessKey  string
	SecretKey  string
	Domain     string // 必填：绑定在七牛空间的访问域名
	UploadHost string
}

type qiniuPutPolicy struct {
	Scope      string `json:"scope"` // 仅 bucket，key 由表单指定
	Deadline   int64  `json:"deadline"`
	ReturnBody string `json:"returnBody,omitempty"`
}

func NewQiniu() *QiniuProvider {
	region := opt("StorageQiniuRegion", "z2")
	hosts := map[string]string{
		"z0":        "https://up.qiniup.com",
		"z1":        "https://up-z1.qiniup.com",
		"z2":        "https://up-z2.qiniup.com",
		"cn-east-2": "https://up-cn-east-2.qiniup.com",
		"na0":       "https://up-na0.qiniup.com",
		"as0":       "https://up-as0.qiniup.com",
	}
	host, ok := hosts[region]
	if !ok {
		host = "https://up-z2.qiniup.com"
	}
	return &QiniuProvider{
		Bucket:     opt("StorageQiniuBucket", ""),
		AccessKey:  opt("StorageQiniuAccessKey", ""),
		SecretKey:  opt("StorageQiniuSecretKey", ""),
		Domain:     strings.TrimSpace(opt("StorageQiniuDomain", "")),
		UploadHost: host,
	}
}

func (p *QiniuProvider) Upload(key, contentType string, data []byte) (string, error) {
	if p.Bucket == "" || p.AccessKey == "" || p.SecretKey == "" || p.Domain == "" {
		return "", fmt.Errorf("七牛未配置完整（bucket/accessKey/secretKey/domain）")
	}

	deadline := time.Now().Add(1 * time.Hour).Unix()
	policy := qiniuPutPolicy{
		Scope:      p.Bucket,
		Deadline:   deadline,
		ReturnBody: `{"key":"$(key)","hash":"$(etag)"}`,
	}
	policyBytes, err := json.Marshal(policy)
	if err != nil {
		return "", err
	}
	encodedPolicy := base64.URLEncoding.EncodeToString(policyBytes)

	mac := hmac.New(sha1.New, []byte(p.SecretKey))
	mac.Write([]byte(encodedPolicy))
	sign := base64.URLEncoding.EncodeToString(mac.Sum(nil))
	token := fmt.Sprintf("%s:%s:%s", p.AccessKey, sign, encodedPolicy)

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	if err := writer.WriteField("token", token); err != nil {
		return "", err
	}
	if err := writer.WriteField("key", key); err != nil {
		return "", err
	}
	part, err := writer.CreateFormFile("file", key)
	if err != nil {
		return "", err
	}
	if _, err := part.Write(data); err != nil {
		return "", err
	}
	if err := writer.Close(); err != nil {
		return "", err
	}

	req, err := http.NewRequest(http.MethodPost, p.UploadHost, body)
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	rb, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 300 {
		return "", fmt.Errorf("七牛上传失败: %d %s", resp.StatusCode, string(rb))
	}
	return strings.TrimRight(p.Domain, "/") + "/" + key, nil
}
