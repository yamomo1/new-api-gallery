package setting

import (
	"github.com/QuantumNous/new-api/setting/config"
)

/*
统一计价口径（「幕」体系）。

这是一组**只读口径参数**，用于把「上游成本 → 幕 → 人民币」的换算固化下来，
供后台「统一定价」页面做换算器与一致性校验。

它不改变既有计费公式：
  - 实际扣费仍由 ModelRatio / CompletionRatio / ModelPrice / GroupRatio 决定；
  - 这里的常数只回答「1 幕值多少钱」「1 元发多少幕」「定价该留多少毛利」。

字段名即数据库 option key 的后缀（pricing_policy.<json tag>），
前端后台定价页按同一套 key 读写。
*/
type PricingPolicy struct {
	// MuEnabled 是否启用「幕」作为展示与充值口径
	MuEnabled bool `json:"mu_enabled"`
	// MuPerRMB 1 元人民币发多少幕（1 元 = 10 幕 → 1 幕 = ¥0.10）
	MuPerRMB float64 `json:"mu_per_rmb"`
	// QuotaPerMu 1 幕 = 多少 New API quota（工程常数，向下取整以保证毛利）
	QuotaPerMu int `json:"quota_per_mu"`
	// BaseMargin 定价基准毛利率（单品挂牌应达到，0~1）
	BaseMargin float64 `json:"base_margin"`
	// TargetMargin 综合验收毛利率下限（0~1），低于它要触发调价
	TargetMargin float64 `json:"target_margin"`
}

// 默认口径：v3 方案（1 元 = 10 幕，1 幕 = 5,136 quota，25% 定价 / 20% 验收）
var pricingPolicy = PricingPolicy{
	MuEnabled:    true,
	MuPerRMB:     10,
	QuotaPerMu:   5136,
	BaseMargin:   0.25,
	TargetMargin: 0.20,
}

func init() {
	config.GlobalConfig.Register("pricing_policy", &pricingPolicy)
}

// GetPricingPolicy 返回当前计价口径（供其他模块做换算展示）
func GetPricingPolicy() PricingPolicy {
	return pricingPolicy
}

// MuPrice 单幕售价（元）
func (p PricingPolicy) MuPrice() float64 {
	if p.MuPerRMB <= 0 {
		return 0
	}
	return 1 / p.MuPerRMB
}

// QuotaPerRMB 1 元人民币对应的 quota
func (p PricingPolicy) QuotaPerRMB() int {
	return int(p.MuPerRMB) * p.QuotaPerMu
}

// Sanitize 兜底非法值，避免除数归零把页面算崩
func (p *PricingPolicy) Sanitize() {
	if p.MuPerRMB <= 0 {
		p.MuPerRMB = 10
	}
	if p.QuotaPerMu <= 0 {
		p.QuotaPerMu = 5136
	}
	if p.BaseMargin < 0 || p.BaseMargin >= 1 {
		p.BaseMargin = 0.25
	}
	if p.TargetMargin < 0 || p.TargetMargin >= 1 {
		p.TargetMargin = 0.20
	}
}
