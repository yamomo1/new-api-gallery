package alipay

import (
	"context"
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// gatewayResponse 拼出支付宝网关的响应信封：业务节点 + 该节点原始 JSON 的签名
func gatewayResponse(t *testing.T, node string, payload map[string]any, signKey string) []byte {
	t.Helper()
	nodeJSON, err := json.Marshal(payload)
	require.NoError(t, err)

	sign, err := signRawContent(string(nodeJSON), signKey)
	require.NoError(t, err)

	envelope := map[string]any{
		node:   json.RawMessage(nodeJSON),
		"sign": sign,
	}
	raw, err := json.Marshal(envelope)
	require.NoError(t, err)
	return raw
}

// signRawContent 对原始 JSON 文本做 SHA256withRSA 签名（模拟支付宝对响应体的签名方式）
func signRawContent(content, privateKey string) (string, error) {
	key, err := ParsePrivateKey(privateKey)
	if err != nil {
		return "", err
	}
	hashed := sha256.Sum256([]byte(content))
	signature, err := rsa.SignPKCS1v15(rand.Reader, key, crypto.SHA256, hashed[:])
	if err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(signature), nil
}

func TestPrecreateParsesSignedGatewayResponse(t *testing.T) {
	appPrivate, appPublic := generateTestKeys(t)
	alipayPrivate, alipayPublic := generateTestKeys(t)

	var seenForm map[string]string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.NoError(t, r.ParseForm())
		params := map[string]string{}
		for key := range r.PostForm {
			params[key] = r.PostForm.Get(key)
		}
		seenForm = params

		// 站点的请求签名必须能用「应用公钥」验证通过
		if err := Verify(params, appPublic); err != nil {
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{"error_response":{"code":"40002","msg":"invalid sign"}}`))
			return
		}

		body := gatewayResponse(t, "alipay_trade_precreate_response", map[string]any{
			"code":         "10000",
			"msg":          "Success",
			"out_trade_no": params["biz_content"],
			"qr_code":      "https://qr.alipay.com/bax0123456789",
		}, alipayPrivate)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write(body)
	}))
	defer server.Close()

	client := NewConfig("2021000000000009", appPrivate, alipayPublic, server.URL, "https://example.com/notify", "")
	qr, err := client.Precreate(context.Background(), Order{
		OutTradeNo:  "ALI9NOQR",
		Subject:     "支付宝 10",
		TotalAmount: "10.00",
	})
	require.NoError(t, err)
	assert.Equal(t, "https://qr.alipay.com/bax0123456789", qr)

	assert.Equal(t, "alipay.trade.precreate", seenForm["method"])
	assert.Equal(t, "2021000000000009", seenForm["app_id"])
	assert.Equal(t, "RSA2", seenForm["sign_type"])
	assert.Equal(t, "https://example.com/notify", seenForm["notify_url"])
	assert.Contains(t, seenForm["biz_content"], `"out_trade_no":"ALI9NOQR"`)
}

func TestPrecreateRejectsTamperedResponsePayload(t *testing.T) {
	appPrivate, _ := generateTestKeys(t)
	alipayPrivate, alipayPublic := generateTestKeys(t)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body := gatewayResponse(t, "alipay_trade_precreate_response", map[string]any{
			"code":    "10000",
			"msg":     "Success",
			"qr_code": "https://qr.alipay.com/real",
		}, alipayPrivate)

		// 篡改业务节点但保留原签名
		var envelope map[string]json.RawMessage
		require.NoError(t, json.Unmarshal(body, &envelope))
		envelope["alipay_trade_precreate_response"] = json.RawMessage(
			`{"code":"10000","msg":"Success","qr_code":"https://qr.alipay.com/evil"}`,
		)
		tampered, err := json.Marshal(envelope)
		require.NoError(t, err)
		_, _ = w.Write(tampered)
	}))
	defer server.Close()

	client := NewConfig("2021000000000010", appPrivate, alipayPublic, server.URL, "", "")
	_, err := client.Precreate(context.Background(), Order{
		OutTradeNo:  "ALI10NOQR",
		Subject:     "x",
		TotalAmount: "1.00",
	})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "verify response sign failed")
}

func TestPrecreateSurfacesGatewayBusinessError(t *testing.T) {
	appPrivate, _ := generateTestKeys(t)
	alipayPrivate, alipayPublic := generateTestKeys(t)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body := gatewayResponse(t, "alipay_trade_precreate_response", map[string]any{
			"code":     "40004",
			"msg":      "Business Failed",
			"sub_code": "ACQ.INVALID_PARAMETER",
			"sub_msg":  "参数无效",
		}, alipayPrivate)
		_, _ = w.Write(body)
	}))
	defer server.Close()

	client := NewConfig("2021000000000011", appPrivate, alipayPublic, server.URL, "", "")
	_, err := client.Precreate(context.Background(), Order{
		OutTradeNo:  "ALI11NOQR",
		Subject:     "x",
		TotalAmount: "1.00",
	})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "ACQ.INVALID_PARAMETER")
}

func TestGatewayErrorResponseIsReported(t *testing.T) {
	appPrivate, _ := generateTestKeys(t)
	_, alipayPublic := generateTestKeys(t)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"error_response":{"code":"40006","msg":"Insufficient Token Permissions","sub_code":"isv.insufficient-isv-permissions"}}`))
	}))
	defer server.Close()

	client := NewConfig("2021000000000012", appPrivate, alipayPublic, server.URL, "", "")
	_, err := client.QueryTrade(context.Background(), "ALI12NOQR")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "insufficient-isv-permissions")
}

func TestWapPayURLUsesWapProductCode(t *testing.T) {
	appPrivate, appPublic := generateTestKeys(t)
	client := NewConfig("2021000000000013", appPrivate, appPublic, "", "", "")

	payURL, err := client.WapPayURL(Order{
		OutTradeNo:  "ALI13NOWAP",
		Subject:     "支付宝 10",
		TotalAmount: "10.00",
	})
	require.NoError(t, err)
	assert.Contains(t, payURL, "method=alipay.trade.wap.pay")
	assert.Contains(t, payURL, "QUICK_WAP_WAY")
}
