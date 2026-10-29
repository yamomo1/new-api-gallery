package cost_setting

import (
	"encoding/json"
	"strings"
	"sync"

	"github.com/QuantumNous/new-api/common"
)

// UpstreamCostRatioKey 存储键：模型的上游进货价表（JSON），存在 options 表里。
// 用途：毛利看板用它算「真金白银的进货成本」，与售价（ModelRatio）完全解耦——
// 售价怎么加都不影响成本核算。
const UpstreamCostRatioKey = "UpstreamCostRatio"

// UpstreamCost 单个模型的上游进货价，单位 USD / 1M tokens（和官方报价同一个口径，好填）。
type UpstreamCost struct {
	Input  float64 `json:"in"`
	Output float64 `json:"out"`
}

var (
	mu    sync.RWMutex
	costs = map[string]UpstreamCost{}
)

// Update 解析并应用成本表；JSON 为空或解析失败时保持原值并返回错误。
func Update(jsonStr string) error {
	trimmed := strings.TrimSpace(jsonStr)
	parsed := map[string]UpstreamCost{}
	if trimmed != "" && trimmed != "{}" {
		if err := json.Unmarshal([]byte(trimmed), &parsed); err != nil {
			return err
		}
	}
	mu.Lock()
	costs = parsed
	mu.Unlock()
	// 同步到 OptionMap，保证重启前立即生效（model.UpdateOption 也会刷新这里）
	common.OptionMapRWMutex.Lock()
	common.OptionMap[UpstreamCostRatioKey] = trimmed
	common.OptionMapRWMutex.Unlock()
	return nil
}

// Get 返回成本表快照。
func Get() map[string]UpstreamCost {
	mu.RLock()
	defer mu.RUnlock()
	out := make(map[string]UpstreamCost, len(costs))
	for k, v := range costs {
		out[k] = v
	}
	return out
}

// Match 精确匹配模型名，找不到再退到最长前缀通配（形如 xxx-*）。
func Match(modelName string) (UpstreamCost, bool) {
	mu.RLock()
	defer mu.RUnlock()
	if c, ok := costs[modelName]; ok {
		return c, true
	}
	best := ""
	var found UpstreamCost
	for pattern, c := range costs {
		if !strings.HasSuffix(pattern, "*") {
			continue
		}
		prefix := strings.TrimSuffix(pattern, "*")
		if strings.HasPrefix(modelName, prefix) && len(prefix) > len(best) {
			best = prefix
			found = c
		}
	}
	if best == "" {
		return UpstreamCost{}, false
	}
	return found, true
}

// CostQuota 计算一次调用的上游成本，换算成与日志 quota 相同的单位。
// 推导：quota = USD * common.QuotaPerUnit，而 USD/1M tokens → 每 token 为 usd/1e6。
func CostQuota(modelName string, promptTokens, completionTokens int64) (float64, bool) {
	c, ok := Match(modelName)
	if !ok {
		return 0, false
	}
	perQuota := float64(common.QuotaPerUnit) / 1e6
	return (c.Input*float64(promptTokens) + c.Output*float64(completionTokens)) * perQuota, true
}
