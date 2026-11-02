package alipay

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// generateTestKeys 生成一对测试用 RSA 密钥（与应用私钥 / 支付宝公钥同格式）
func generateTestKeys(t *testing.T) (privateKeyRaw string, publicKeyRaw string) {
	t.Helper()
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	require.NoError(t, err)

	der, err := x509.MarshalPKCS8PrivateKey(key)
	require.NoError(t, err)
	privateKeyRaw = base64.StdEncoding.EncodeToString(der)

	pubDer, err := x509.MarshalPKIXPublicKey(&key.PublicKey)
	require.NoError(t, err)
	publicKeyRaw = base64.StdEncoding.EncodeToString(pubDer)
	return privateKeyRaw, publicKeyRaw
}

func mustPEM(t *testing.T, der []byte, blockType string) string {
	t.Helper()
	return string(pem.EncodeToMemory(&pem.Block{Type: blockType, Bytes: der}))
}

func TestSignContentSortsAndDropsSignatureFields(t *testing.T) {
	params := map[string]string{
		"b":         "2",
		"a":         "1",
		"sign":      "ignored",
		"sign_type": "RSA2",
		"empty":     "",
	}
	assert.Equal(t, "a=1&b=2", SignContent(params))
}

func TestSignAndVerifyRoundTrip(t *testing.T) {
	privateKey, publicKey := generateTestKeys(t)

	params := map[string]string{
		"app_id":      "2021000000000000",
		"method":      "alipay.trade.page.pay",
		"charset":     "utf-8",
		"sign_type":   "RSA2",
		"timestamp":   "2026-11-02 16:00:00",
		"version":     "1.0",
		"biz_content": `{"out_trade_no":"ALI1NOABC","total_amount":"12.00"}`,
	}
	signature, err := Sign(params, privateKey)
	require.NoError(t, err)
	require.NotEmpty(t, signature)

	signed := map[string]string{"sign": signature}
	for key, value := range params {
		signed[key] = value
	}
	require.NoError(t, Verify(signed, publicKey))

	// 篡改金额必须验签失败
	tampered := map[string]string{}
	for key, value := range signed {
		tampered[key] = value
	}
	tampered["biz_content"] = `{"out_trade_no":"ALI1NOABC","total_amount":"0.01"}`
	require.Error(t, Verify(tampered, publicKey))

	// 偷换签名内容必须失败
	tamperedSign := map[string]string{}
	for key, value := range signed {
		tamperedSign[key] = value
	}
	tamperedSign["sign"] = signature[:len(signature)-4] + "AAAA"
	require.Error(t, Verify(tamperedSign, publicKey))
}

func TestVerifyRejectsMissingSignature(t *testing.T) {
	_, publicKey := generateTestKeys(t)
	require.Error(t, Verify(map[string]string{"a": "1"}, publicKey))
}

func TestParseKeysAcceptsPEMAndRawBase64(t *testing.T) {
	privateKeyRaw, publicKeyRaw := generateTestKeys(t)

	// 裸 base64（开放平台复制出来的默认形态）
	_, err := ParsePrivateKey(privateKeyRaw)
	require.NoError(t, err)
	_, err = ParsePublicKey(publicKeyRaw)
	require.NoError(t, err)

	// 带 PEM 头
	privDer, err := base64.StdEncoding.DecodeString(privateKeyRaw)
	require.NoError(t, err)
	pubDer, err := base64.StdEncoding.DecodeString(publicKeyRaw)
	require.NoError(t, err)
	_, err = ParsePrivateKey(mustPEM(t, privDer, "PRIVATE KEY"))
	require.NoError(t, err)
	_, err = ParsePublicKey(mustPEM(t, pubDer, "PUBLIC KEY"))
	require.NoError(t, err)

	// 换行折行也必须能解析
	wrapped := ""
	for index, char := range privateKeyRaw {
		if index > 0 && index%64 == 0 {
			wrapped += "\n"
		}
		wrapped += string(char)
	}
	_, err = ParsePrivateKey(wrapped)
	require.NoError(t, err)
}

func TestParsePrivateKeyRejectsGarbage(t *testing.T) {
	_, err := ParsePrivateKey("not-a-key")
	require.Error(t, err)
	_, err = ParsePrivateKey("")
	require.ErrorIs(t, err, ErrEmptyKey)
}

func TestSignWithTypeRSAProducesVerifiableSignature(t *testing.T) {
	privateKey, publicKey := generateTestKeys(t)
	params := map[string]string{"a": "1", "b": "2"}

	signature, err := SignWithType(params, privateKey, SignTypeRSA)
	require.NoError(t, err)

	withSign := map[string]string{"a": "1", "b": "2", "sign": signature, "sign_type": "RSA"}
	require.NoError(t, Verify(withSign, publicKey))
}

func TestPagePayURLContainsSignedParams(t *testing.T) {
	privateKey, publicKey := generateTestKeys(t)
	client := NewConfig("2021000000000000", privateKey, publicKey, "", "https://example.com/notify", "https://example.com/return")

	payURL, err := client.PagePayURL(Order{
		OutTradeNo:     "ALI1NOABC123",
		Subject:        "支付宝 10",
		TotalAmount:    "10.00",
		TimeoutExpress: "30m",
	})
	require.NoError(t, err)
	assert.Contains(t, payURL, "https://openapi.alipay.com/gateway.do?")
	assert.Contains(t, payURL, "method=alipay.trade.page.pay")
	assert.Contains(t, payURL, "sign_type=RSA2")
	assert.Contains(t, payURL, "notify_url=https%3A%2F%2Fexample.com%2Fnotify")
	assert.Contains(t, payURL, "return_url=https%3A%2F%2Fexample.com%2Freturn")
	assert.Contains(t, payURL, "sign=")
}

func TestWebPayURLRejectsIncompleteOrder(t *testing.T) {
	privateKey, publicKey := generateTestKeys(t)
	client := NewConfig("2021000000000000", privateKey, publicKey, "", "", "")

	_, err := client.PagePayURL(Order{Subject: "x", TotalAmount: "1.00"})
	require.Error(t, err)

	_, err = client.WapPayURL(Order{OutTradeNo: "A", TotalAmount: "1.00"})
	require.Error(t, err)
}
