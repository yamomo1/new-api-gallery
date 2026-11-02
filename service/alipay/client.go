package alipay

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

/*
支付宝开放平台网关客户端。

覆盖本项目需要的三个支付产品：
- 电脑网站支付 alipay.trade.page.pay   → 返回可让浏览器跳转的 URL（GET 形式）
- 手机网站支付 alipay.trade.wap.pay    → 同上，H5 收银台
- 当面付预下单 alipay.trade.precreate  → 服务端调用，返回二维码内容

以及 alipay.trade.query 用于同步返回时的补偿查单。
*/

// Config 网关与密钥配置
type Config struct {
	AppId      string
	PrivateKey string
	PublicKey  string
	Gateway    string
	NotifyURL  string
	ReturnURL  string
	SignType   string
}

// Order 下单参数
type Order struct {
	OutTradeNo     string
	Subject        string
	Body           string
	TotalAmount    string // 元，两位小数，如 "12.00"
	TimeoutExpress string // 如 "30m"
	// ProductCode 可覆盖默认 product_code
	ProductCode string
}

// TradeStatus 支付宝交易状态
const (
	TradeStatusWaitBuyerPay = "WAIT_BUYER_PAY"
	TradeStatusTradeClosed  = "TRADE_CLOSED"
	TradeStatusSuccess      = "TRADE_SUCCESS"
	TradeStatusFinished     = "TRADE_FINISHED"
)

// TradeQueryResult 交易查询结果
type TradeQueryResult struct {
	OutTradeNo  string
	TradeNo     string
	TradeStatus string
	TotalAmount string
	BuyerId     string
	BuyerLogon  string
	SendPayDate string
}

var httpClient = &http.Client{Timeout: 15 * time.Second}

// NewConfig 归一化配置
func NewConfig(appId, privateKey, publicKey, gateway, notifyURL, returnURL string) *Config {
	if strings.TrimSpace(gateway) == "" {
		gateway = "https://openapi.alipay.com/gateway.do"
	}
	return &Config{
		AppId:      strings.TrimSpace(appId),
		PrivateKey: privateKey,
		PublicKey:  publicKey,
		Gateway:    strings.TrimSpace(gateway),
		NotifyURL:  strings.TrimSpace(notifyURL),
		ReturnURL:  strings.TrimSpace(returnURL),
		SignType:   SignTypeRSA2,
	}
}

// chinaLocation 支付宝要求 timestamp 为北京时间（GMT+8）
func chinaLocation() *time.Location {
	if loc, err := time.LoadLocation("Asia/Shanghai"); err == nil {
		return loc
	}
	return time.FixedZone("CST", 8*3600)
}

func (c *Config) commonParams(method string, bizContent any) (map[string]string, error) {
	biz, err := json.Marshal(bizContent)
	if err != nil {
		return nil, fmt.Errorf("alipay: marshal biz_content failed: %w", err)
	}
	params := map[string]string{
		"app_id":      c.AppId,
		"method":      method,
		"format":      "JSON",
		"charset":     "utf-8",
		"sign_type":   c.SignType,
		"timestamp":   time.Now().In(chinaLocation()).Format("2006-01-02 15:04:05"),
		"version":     "1.0",
		"biz_content": string(biz),
	}
	if c.NotifyURL != "" {
		params["notify_url"] = c.NotifyURL
	}
	return params, nil
}

func (c *Config) signParams(params map[string]string) (map[string]string, error) {
	sign, err := SignWithType(params, c.PrivateKey, c.SignType)
	if err != nil {
		return nil, err
	}
	signed := make(map[string]string, len(params)+1)
	for key, value := range params {
		signed[key] = value
	}
	signed["sign"] = sign
	return signed, nil
}

// PagePayURL 电脑网站支付：拼出可跳转的收银台地址
func (c *Config) PagePayURL(order Order) (string, error) {
	return c.webPayURL("alipay.trade.page.pay", "FAST_INSTANT_TRADE_PAY", order, true)
}

// WapPayURL 手机网站支付：H5 收银台
func (c *Config) WapPayURL(order Order) (string, error) {
	return c.webPayURL("alipay.trade.wap.pay", "QUICK_WAP_WAY", order, true)
}

func (c *Config) webPayURL(method, defaultProductCode string, order Order, withReturnURL bool) (string, error) {
	if err := validateOrder(order); err != nil {
		return "", err
	}
	productCode := order.ProductCode
	if productCode == "" {
		productCode = defaultProductCode
	}
	biz := map[string]any{
		"out_trade_no": order.OutTradeNo,
		"total_amount": order.TotalAmount,
		"subject":      order.Subject,
		"product_code": productCode,
	}
	if order.Body != "" {
		biz["body"] = order.Body
	}
	if order.TimeoutExpress != "" {
		biz["timeout_express"] = order.TimeoutExpress
	}

	params, err := c.commonParams(method, biz)
	if err != nil {
		return "", err
	}
	if withReturnURL && c.ReturnURL != "" {
		params["return_url"] = c.ReturnURL
	}
	signed, err := c.signParams(params)
	if err != nil {
		return "", err
	}

	values := url.Values{}
	for key, value := range signed {
		values.Set(key, value)
	}
	separator := "?"
	if strings.Contains(c.Gateway, "?") {
		separator = "&"
	}
	return c.Gateway + separator + values.Encode(), nil
}

// Precreate 当面付预下单，返回二维码内容（qr_code）
func (c *Config) Precreate(ctx context.Context, order Order) (string, error) {
	if err := validateOrder(order); err != nil {
		return "", err
	}
	biz := map[string]any{
		"out_trade_no": order.OutTradeNo,
		"total_amount": order.TotalAmount,
		"subject":      order.Subject,
	}
	if order.Body != "" {
		biz["body"] = order.Body
	}
	if order.TimeoutExpress != "" {
		biz["timeout_express"] = order.TimeoutExpress
	}

	payload, err := c.call(ctx, "alipay.trade.precreate", biz)
	if err != nil {
		return "", err
	}
	code := stringField(payload, "qr_code")
	if code == "" {
		return "", errors.New("alipay: precreate response missing qr_code")
	}
	return code, nil
}

// QueryTrade 交易查询（用于同步返回页补偿查单）
func (c *Config) QueryTrade(ctx context.Context, outTradeNo string) (*TradeQueryResult, error) {
	if strings.TrimSpace(outTradeNo) == "" {
		return nil, errors.New("alipay: out_trade_no is required")
	}
	payload, err := c.call(ctx, "alipay.trade.query", map[string]any{
		"out_trade_no": outTradeNo,
	})
	if err != nil {
		return nil, err
	}
	return &TradeQueryResult{
		OutTradeNo:  stringField(payload, "out_trade_no"),
		TradeNo:     stringField(payload, "trade_no"),
		TradeStatus: stringField(payload, "trade_status"),
		TotalAmount: stringField(payload, "total_amount"),
		BuyerId:     stringField(payload, "buyer_user_id"),
		BuyerLogon:  stringField(payload, "buyer_logon_id"),
		SendPayDate: stringField(payload, "send_pay_date"),
	}, nil
}

func (c *Config) call(ctx context.Context, method string, bizContent any) (map[string]any, error) {
	params, err := c.commonParams(method, bizContent)
	if err != nil {
		return nil, err
	}
	signed, err := c.signParams(params)
	if err != nil {
		return nil, err
	}

	form := url.Values{}
	for key, value := range signed {
		form.Set(key, value)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.Gateway, strings.NewReader(form.Encode()))
	if err != nil {
		return nil, fmt.Errorf("alipay: build request failed: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded;charset=utf-8")
	req.Header.Set("Accept", "application/json")

	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("alipay: request failed: %w", err)
	}
	defer func() {
		_ = resp.Body.Close()
	}()

	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return nil, fmt.Errorf("alipay: read response failed: %w", err)
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("alipay: gateway http status %d", resp.StatusCode)
	}

	node := strings.ReplaceAll(method, ".", "_") + "_response"
	return c.parseResponse(body, node)
}

// parseResponse 解析网关响应：校验响应签名，code!=10000 时返回业务错误
func (c *Config) parseResponse(body []byte, node string) (map[string]any, error) {
	var envelope map[string]json.RawMessage
	if err := json.Unmarshal(body, &envelope); err != nil {
		return nil, fmt.Errorf("alipay: invalid response: %w", err)
	}
	rawNode, ok := envelope[node]
	if !ok {
		// 网关级错误（app_id 不匹配、签名错误等）会返回 error_response
		if rawErr, hasErr := envelope["error_response"]; hasErr {
			var payload map[string]any
			_ = json.Unmarshal(rawErr, &payload)
			return nil, fmt.Errorf("alipay: %s", describeFailure(payload))
		}
		return nil, fmt.Errorf("alipay: response missing %s", node)
	}

	if c.PublicKey != "" {
		if rawSign, hasSign := envelope["sign"]; hasSign {
			var signature string
			if err := json.Unmarshal(rawSign, &signature); err == nil {
				if err := VerifyContent(string(rawNode), signature, c.PublicKey); err != nil {
					return nil, err
				}
			}
		}
	}

	var payload map[string]any
	if err := json.Unmarshal(rawNode, &payload); err != nil {
		return nil, fmt.Errorf("alipay: invalid response payload: %w", err)
	}
	if code := stringField(payload, "code"); code != "10000" {
		return nil, fmt.Errorf("alipay: %s", describeFailure(payload))
	}
	return payload, nil
}

func describeFailure(payload map[string]any) string {
	code := stringField(payload, "code")
	msg := stringField(payload, "msg")
	subCode := stringField(payload, "sub_code")
	subMsg := stringField(payload, "sub_msg")
	parts := make([]string, 0, 4)
	if code != "" {
		parts = append(parts, code)
	}
	if msg != "" {
		parts = append(parts, msg)
	}
	if subCode != "" {
		parts = append(parts, subCode)
	}
	if subMsg != "" {
		parts = append(parts, subMsg)
	}
	if len(parts) == 0 {
		return "unknown error"
	}
	return strings.Join(parts, " | ")
}

func stringField(payload map[string]any, key string) string {
	value, ok := payload[key]
	if !ok || value == nil {
		return ""
	}
	switch typed := value.(type) {
	case string:
		return typed
	case float64:
		return strconv.FormatFloat(typed, 'f', -1, 64)
	case bool:
		return strconv.FormatBool(typed)
	default:
		return fmt.Sprintf("%v", typed)
	}
}

func validateOrder(order Order) error {
	if strings.TrimSpace(order.OutTradeNo) == "" {
		return errors.New("alipay: out_trade_no is required")
	}
	if strings.TrimSpace(order.Subject) == "" {
		return errors.New("alipay: subject is required")
	}
	if strings.TrimSpace(order.TotalAmount) == "" {
		return errors.New("alipay: total_amount is required")
	}
	return nil
}
