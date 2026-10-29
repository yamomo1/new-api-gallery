package storage

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// S3Provider 通过 AWS Signature V4 直传，覆盖 AWS S3、Cloudflare R2、腾讯云 COS、MinIO 等
// 所有 S3 兼容接口。采用 path-style 地址（endpoint/bucket/key），不依赖官方 SDK。
type S3Provider struct {
	Bucket    string
	Endpoint  string // 如 https://s3.us-east-1.amazonaws.com / https://<id>.r2.cloudflarestorage.com / https://minio.host:9000
	Region    string
	AccessKey string
	Secret    string
	Domain    string // 可选：公开访问域名，填了就用它拼 URL
}

func NewS3(prefix string) *S3Provider {
	return &S3Provider{
		Bucket:    opt("Storage"+prefix+"S3Bucket", ""),
		Endpoint:  strings.TrimRight(opt("Storage"+prefix+"S3Endpoint", ""), "/"),
		Region:    opt("Storage"+prefix+"S3Region", "auto"),
		AccessKey: opt("Storage"+prefix+"S3AccessKey", ""),
		Secret:    opt("Storage"+prefix+"S3Secret", ""),
		Domain:    strings.TrimSpace(opt("Storage"+prefix+"S3Domain", "")),
	}
}

func (p *S3Provider) Upload(key, contentType string, data []byte) (string, error) {
	if p.Bucket == "" || p.Endpoint == "" || p.AccessKey == "" || p.Secret == "" {
		return "", fmt.Errorf("S3 未配置完整（bucket/endpoint/accessKey/secret）")
	}
	region := p.Region
	if region == "" {
		region = "auto"
	}

	u, err := url.Parse(p.Endpoint)
	if err != nil {
		return "", err
	}
	signHost := u.Host

	payloadHash := sha256.Sum256(data)
	payloadHex := hex.EncodeToString(payloadHash[:])

	amzDate := time.Now().UTC().Format("20060102T150405Z")
	dateStamp := amzDate[:8]

	canonicalURI := "/" + p.Bucket + "/" + key
	canonicalHeaders := fmt.Sprintf("host:%s\nx-amz-content-sha256:%s\nx-amz-date:%s\n",
		signHost, payloadHex, amzDate)
	signedHeaders := "host;x-amz-content-sha256;x-amz-date"

	canonicalRequest := strings.Join([]string{
		"PUT",
		canonicalURI,
		"",
		canonicalHeaders,
		signedHeaders,
		payloadHex,
	}, "\n")

	h := sha256.Sum256([]byte(canonicalRequest))
	canonicalRequestHash := hex.EncodeToString(h[:])

	scope := fmt.Sprintf("%s/%s/s3/aws4_request", dateStamp, region)
	stringToSign := strings.Join([]string{
		"AWS4-HMAC-SHA256",
		amzDate,
		scope,
		canonicalRequestHash,
	}, "\n")

	signingKey := hmacSHA256([]byte("AWS4"+p.Secret), dateStamp)
	signingKey = hmacSHA256(signingKey, region)
	signingKey = hmacSHA256(signingKey, "s3")
	signingKey = hmacSHA256(signingKey, "aws4_request")
	signature := hex.EncodeToString(hmacSHA256(signingKey, stringToSign))

	authHeader := fmt.Sprintf("AWS4-HMAC-SHA256 Credential=%s/%s, SignedHeaders=%s, Signature=%s",
		p.AccessKey, scope, signedHeaders, signature)

	objectURL := fmt.Sprintf("%s/%s/%s", p.Endpoint, p.Bucket, key)
	req, err := http.NewRequest(http.MethodPut, objectURL, bytes.NewReader(data))
	if err != nil {
		return "", err
	}
	req.Header.Set("Host", signHost)
	req.Header.Set("X-Amz-Content-Sha256", payloadHex)
	req.Header.Set("X-Amz-Date", amzDate)
	req.Header.Set("Content-Type", contentType)
	req.Header.Set("Authorization", authHeader)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	rb, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 300 {
		return "", fmt.Errorf("S3 上传失败: %d %s", resp.StatusCode, string(rb))
	}

	if p.Domain != "" {
		return strings.TrimRight(p.Domain, "/") + "/" + key, nil
	}
	return objectURL, nil
}

func hmacSHA256(key []byte, data string) []byte {
	mac := hmac.New(sha256.New, key)
	mac.Write([]byte(data))
	return mac.Sum(nil)
}
