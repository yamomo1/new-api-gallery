package storage

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha1"
	"encoding/base64"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// AliOSSProvider 通过阿里云 OSS REST API 直传（HMAC-SHA1 签名），不依赖官方 SDK。
// 文档：PUT Object 签名 = base64(HMAC-SHA1(Secret, "PUT\n\n<Content-Type>\n<Date>\n/<bucket>/<key>"))
type AliOSSProvider struct {
	Bucket    string
	Endpoint  string // 如 oss-cn-hangzhou.aliyuncs.com
	AccessKey string
	Secret    string
	Domain    string // 可选自定义域名，填了就用它拼 URL
}

func NewAliOSS() *AliOSSProvider {
	return &AliOSSProvider{
		Bucket:    opt("StorageAliOSSBucket", ""),
		Endpoint:  strings.TrimSpace(opt("StorageAliOSSEndpoint", "")),
		AccessKey: opt("StorageAliOSSAccessKey", ""),
		Secret:    opt("StorageAliOSSSecret", ""),
		Domain:    strings.TrimSpace(opt("StorageAliOSSDomain", "")),
	}
}

func (p *AliOSSProvider) Upload(key, contentType string, data []byte) (string, error) {
	if p.Bucket == "" || p.Endpoint == "" || p.AccessKey == "" || p.Secret == "" {
		return "", fmt.Errorf("aliyun OSS 未配置完整（bucket/endpoint/accessKey/secret）")
	}
	host := fmt.Sprintf("%s.%s", p.Bucket, p.Endpoint)
	date := time.Now().UTC().Format(http.TimeFormat) // RFC1123 GMT

	canonical := fmt.Sprintf("PUT\n\n%s\n%s\n/%s/%s", contentType, date, p.Bucket, key)
	mac := hmac.New(sha1.New, []byte(p.Secret))
	mac.Write([]byte(canonical))
	sign := base64.StdEncoding.EncodeToString(mac.Sum(nil))

	url := fmt.Sprintf("https://%s/%s", host, key)
	req, err := http.NewRequest(http.MethodPut, url, bytes.NewReader(data))
	if err != nil {
		return "", err
	}
	req.Header.Set("Date", date)
	req.Header.Set("Content-Type", contentType)
	req.Header.Set("Authorization", fmt.Sprintf("OSS %s:%s", p.AccessKey, sign))

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 300 {
		return "", fmt.Errorf("aliyun OSS 上传失败: %d %s", resp.StatusCode, string(body))
	}

	if p.Domain != "" {
		return strings.TrimRight(p.Domain, "/") + "/" + key, nil
	}
	return fmt.Sprintf("https://%s/%s", host, key), nil
}
