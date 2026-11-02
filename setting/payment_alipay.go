package setting

import (
	"strings"

	"github.com/QuantumNous/new-api/setting/config"
)

/*
支付宝官方（开放平台）支付配置。

与 Epay（易支付聚合）里的 "alipay" 支付方式互不影响：
  - Epay 走第三方聚合网关，代签约、代收款；
  - 本配置直接对接支付宝开放平台的「电脑网站支付 / 手机网站支付 / 当面付」，
    使用应用私钥对请求做 RSA2 签名，用支付宝公钥校验异步通知。

字段名即数据库 option key 的后缀（alipay_setting.<json tag>），
前端后台设置页按同一套 key 读写。
*/
type AlipaySetting struct {
	Enabled bool `json:"enabled"`
	// Sandbox 为 true 时使用支付宝沙箱网关（未填 gateway 时生效）
	Sandbox bool   `json:"sandbox"`
	AppId   string `json:"app_id"`
	// PrivateKey 应用私钥（PKCS#8 或 PKCS#1 的 base64，可带或不带 PEM 头）
	PrivateKey string `json:"private_key"`
	// PublicKeyPem 支付宝公钥（用于验签，X.509 SubjectPublicKeyInfo 的 base64）
	PublicKeyPem string `json:"public_key_pem"`
	// Gateway 自定义网关地址，留空按 sandbox 自动选择
	Gateway string `json:"gateway"`
	// Mode 支付模式：page 电脑网站 / wap 手机网站 / qr 当面付扫码
	Mode        string `json:"mode"`
	NotifyUrl   string `json:"notify_url"`
	ReturnUrl   string `json:"return_url"`
	DisplayName string `json:"display_name"`
	MinTopUp    int    `json:"min_topup"`
	// TimeoutExpress 订单超时时间（如 30m / 2h），超时后支付宝关闭交易
	TimeoutExpress string `json:"timeout_express"`
}

const (
	// AlipayModePage 电脑网站支付（alipay.trade.page.pay）
	AlipayModePage = "page"
	// AlipayModeWap 手机网站支付（alipay.trade.wap.pay）
	AlipayModeWap = "wap"
	// AlipayModeQr 当面付扫码（alipay.trade.precreate）
	AlipayModeQr = "qr"

	// DefaultAlipayGateway 正式环境网关
	DefaultAlipayGateway = "https://openapi.alipay.com/gateway.do"
	// SandboxAlipayGateway 沙箱网关
	SandboxAlipayGateway = "https://openapi-sandbox.dl.alipaydev.com/gateway.do"

	// PaymentMethodAlipay 落库的支付方式（与 Epay 的 alipay 同义，表示「用支付宝付款」）
	PaymentMethodAlipay = "alipay"
	// PaymentMethodTypeAlipayOfficial 前端识别用的支付方式类型，避免与 Epay 的 alipay 冲突
	PaymentMethodTypeAlipayOfficial = "alipay_official"
)

var alipaySetting = AlipaySetting{
	Mode: AlipayModePage,
	// 默认叫「支付宝官方」，避免与 Epay 聚合里的「支付宝」重名
	DisplayName:    "支付宝官方",
	MinTopUp:       1,
	TimeoutExpress: "30m",
}

func init() {
	config.GlobalConfig.Register("alipay_setting", &alipaySetting)
}

func GetAlipaySetting() *AlipaySetting {
	return &alipaySetting
}

// Configured 三个必填项齐备才算可发起支付
func (s *AlipaySetting) Configured() bool {
	return strings.TrimSpace(s.AppId) != "" &&
		strings.TrimSpace(s.PrivateKey) != "" &&
		strings.TrimSpace(s.PublicKeyPem) != ""
}

// GatewayURL 返回实际使用的网关地址
func (s *AlipaySetting) GatewayURL() string {
	if trimmed := strings.TrimSpace(s.Gateway); trimmed != "" {
		return trimmed
	}
	if s.Sandbox {
		return SandboxAlipayGateway
	}
	return DefaultAlipayGateway
}

// NormalizedMode 兜底非法配置值
func (s *AlipaySetting) NormalizedMode() string {
	switch strings.ToLower(strings.TrimSpace(s.Mode)) {
	case AlipayModeWap:
		return AlipayModeWap
	case AlipayModeQr:
		return AlipayModeQr
	default:
		return AlipayModePage
	}
}

// EffectiveDisplayName 支付方式展示名
func (s *AlipaySetting) EffectiveDisplayName() string {
	if trimmed := strings.TrimSpace(s.DisplayName); trimmed != "" {
		return trimmed
	}
	return "支付宝官方"
}

// EffectiveTimeoutExpress 订单超时时间，缺省 30m
func (s *AlipaySetting) EffectiveTimeoutExpress() string {
	if trimmed := strings.TrimSpace(s.TimeoutExpress); trimmed != "" {
		return trimmed
	}
	return "30m"
}
