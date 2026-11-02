package alipay

import (
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha1"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"errors"
	"fmt"
	"sort"
	"strings"
)

/*
支付宝开放平台签名工具（RSA2 / RSA）。

只依赖标准库：支付宝「应用私钥」是 RSA 私钥的 base64（PKCS#8 或 PKCS#1，通常不带 PEM 头），
「支付宝公钥」是 X.509 SubjectPublicKeyInfo 的 base64。这里同时兼容带不带 PEM 头的写法，
后台直接粘贴开放平台复制出来的字符串即可。

签名规则（官方）：取所有非空参数，剔除 sign 与 sign_type，按参数名升序拼成
`k1=v1&k2=v2`，用 SHA256withRSA（RSA2）签名后 base64。异步通知验签用同一套拼装规则。
*/

const (
	// SignTypeRSA2 SHA256withRSA
	SignTypeRSA2 = "RSA2"
	// SignTypeRSA SHA1withRSA（老应用可能仍在用）
	SignTypeRSA = "RSA"
)

// ErrEmptyKey 未配置密钥
var ErrEmptyKey = errors.New("alipay: key is empty")

// SignContent 按支付宝规则拼接待签名字符串。
// 请求签名与通知验签的规则一致：剔除 sign、sign_type 与空值。
func SignContent(params map[string]string) string {
	keys := make([]string, 0, len(params))
	for key, value := range params {
		switch key {
		case "sign", "sign_type":
			continue
		}
		if value == "" {
			continue
		}
		keys = append(keys, key)
	}
	sort.Strings(keys)

	var builder strings.Builder
	for index, key := range keys {
		if index > 0 {
			builder.WriteByte('&')
		}
		builder.WriteString(key)
		builder.WriteByte('=')
		builder.WriteString(params[key])
	}
	return builder.String()
}

// Sign 用应用私钥对参数签名（默认 RSA2）
func Sign(params map[string]string, privateKeyRaw string) (string, error) {
	return SignWithType(params, privateKeyRaw, SignTypeRSA2)
}

// SignWithType 指定签名算法
func SignWithType(params map[string]string, privateKeyRaw, signType string) (string, error) {
	key, err := ParsePrivateKey(privateKeyRaw)
	if err != nil {
		return "", err
	}
	content := SignContent(params)

	hashed, hash, err := digest(content, signType)
	if err != nil {
		return "", err
	}
	signature, err := rsa.SignPKCS1v15(rand.Reader, key, hash, hashed)
	if err != nil {
		return "", fmt.Errorf("alipay: sign failed: %w", err)
	}
	return base64.StdEncoding.EncodeToString(signature), nil
}

// Verify 用支付宝公钥校验签名（sign_type 缺省按 RSA2）
func Verify(params map[string]string, publicKeyRaw string) error {
	signatureBase64 := strings.TrimSpace(params["sign"])
	if signatureBase64 == "" {
		return errors.New("alipay: missing sign")
	}
	signType := strings.TrimSpace(params["sign_type"])
	if signType == "" {
		signType = SignTypeRSA2
	}

	key, err := ParsePublicKey(publicKeyRaw)
	if err != nil {
		return err
	}
	signature, err := base64.StdEncoding.DecodeString(signatureBase64)
	if err != nil {
		return fmt.Errorf("alipay: invalid sign encoding: %w", err)
	}
	hashed, hash, err := digest(SignContent(params), signType)
	if err != nil {
		return err
	}
	if err := rsa.VerifyPKCS1v15(key, hash, hashed, signature); err != nil {
		return fmt.Errorf("alipay: verify sign failed: %w", err)
	}
	return nil
}

// VerifyContent 校验「网关返回体」：签名对象是响应节点原始 JSON 文本
func VerifyContent(content, signatureBase64, publicKeyRaw string) error {
	if strings.TrimSpace(signatureBase64) == "" {
		return errors.New("alipay: missing sign")
	}
	key, err := ParsePublicKey(publicKeyRaw)
	if err != nil {
		return err
	}
	signature, err := base64.StdEncoding.DecodeString(strings.TrimSpace(signatureBase64))
	if err != nil {
		return fmt.Errorf("alipay: invalid sign encoding: %w", err)
	}
	sum := sha256.Sum256([]byte(content))
	if err := rsa.VerifyPKCS1v15(key, crypto.SHA256, sum[:], signature); err != nil {
		return fmt.Errorf("alipay: verify response sign failed: %w", err)
	}
	return nil
}

func digest(content, signType string) ([]byte, crypto.Hash, error) {
	switch strings.ToUpper(strings.TrimSpace(signType)) {
	case "", SignTypeRSA2:
		sum := sha256.Sum256([]byte(content))
		return sum[:], crypto.SHA256, nil
	case SignTypeRSA:
		sum := sha1.Sum([]byte(content))
		return sum[:], crypto.SHA1, nil
	default:
		return nil, 0, fmt.Errorf("alipay: unsupported sign type %q", signType)
	}
}

// ParsePrivateKey 解析应用私钥（PKCS#8 优先，兼容 PKCS#1）
func ParsePrivateKey(raw string) (*rsa.PrivateKey, error) {
	der, err := decodeKeyBytes(raw, "PRIVATE KEY")
	if err != nil {
		return nil, err
	}
	if key, err := x509.ParsePKCS8PrivateKey(der); err == nil {
		rsaKey, ok := key.(*rsa.PrivateKey)
		if !ok {
			return nil, errors.New("alipay: private key is not RSA")
		}
		return rsaKey, nil
	}
	if key, err := x509.ParsePKCS1PrivateKey(der); err == nil {
		return key, nil
	}
	return nil, errors.New("alipay: failed to parse private key (expect PKCS#8 or PKCS#1)")
}

// ParsePublicKey 解析支付宝公钥（X.509 SubjectPublicKeyInfo）
func ParsePublicKey(raw string) (*rsa.PublicKey, error) {
	der, err := decodeKeyBytes(raw, "PUBLIC KEY")
	if err != nil {
		return nil, err
	}
	key, err := x509.ParsePKIXPublicKey(der)
	if err != nil {
		return nil, errors.New("alipay: failed to parse public key")
	}
	rsaKey, ok := key.(*rsa.PublicKey)
	if !ok {
		return nil, errors.New("alipay: public key is not RSA")
	}
	return rsaKey, nil
}

// decodeKeyBytes 兼容「带 PEM 头」与「裸 base64」两种粘贴方式
func decodeKeyBytes(raw, pemType string) ([]byte, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return nil, ErrEmptyKey
	}
	if strings.Contains(trimmed, "-----BEGIN") {
		block, _ := pem.Decode([]byte(trimmed))
		if block == nil {
			return nil, errors.New("alipay: invalid PEM block")
		}
		return block.Bytes, nil
	}
	compact := strings.Join(strings.Fields(trimmed), "")
	der, err := base64.StdEncoding.DecodeString(compact)
	if err != nil {
		return nil, errors.New("alipay: key is neither PEM nor valid base64")
	}
	_ = pemType
	return der, nil
}
