package controller

import (
	"net/http"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/cost_setting"
	"github.com/gin-gonic/gin"
)

// ModelProfitItem 单个模型的毛利明细。金额单位统一为 quota（与后台额度同口径），
// 前端再按 QuotaPerUnit 折算成美元展示。
type ModelProfitItem struct {
	ModelName        string  `json:"model_name"`
	Requests         int64   `json:"requests"`
	PromptTokens     int64   `json:"prompt_tokens"`
	CompletionTokens int64   `json:"completion_tokens"`
	RevenueQuota     float64 `json:"revenue_quota"` // 用户实际被扣的额度（收入）
	CostQuota        float64 `json:"cost_quota"`    // 按上游进货价折算的成本
	ProfitQuota      float64 `json:"profit_quota"`  // 毛利
	Margin           float64 `json:"margin"`        // 毛利率 0~1
	CostConfigured   bool    `json:"cost_configured"`
}

// GetModelProfit 按模型维度给出收入/成本/毛利，用于后台毛利看板。
func GetModelProfit(c *gin.Context) {
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)

	rows, err := model.GetModelProfitStats(startTimestamp, endTimestamp)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	items := make([]ModelProfitItem, 0, len(rows))
	var totalRevenue, totalCost, totalRequests, totalPrompt, totalCompletion float64
	for _, row := range rows {
		cost := float64(0)
		configured := false
		if q, ok := cost_setting.CostQuota(row.ModelName, row.PromptTokens, row.CompletionTokens); ok {
			cost = q
			configured = true
		}
		item := ModelProfitItem{
			ModelName:        row.ModelName,
			Requests:         row.Requests,
			PromptTokens:     row.PromptTokens,
			CompletionTokens: row.CompletionTokens,
			RevenueQuota:     float64(row.Quota),
			CostQuota:        cost,
			ProfitQuota:      float64(row.Quota) - cost,
			CostConfigured:   configured,
		}
		if item.RevenueQuota > 0 {
			item.Margin = item.ProfitQuota / item.RevenueQuota
		}
		items = append(items, item)

		totalRevenue += item.RevenueQuota
		totalCost += item.CostQuota
		totalRequests += float64(row.Requests)
		totalPrompt += float64(row.PromptTokens)
		totalCompletion += float64(row.CompletionTokens)
	}

	summary := gin.H{
		"revenue_quota":      totalRevenue,
		"cost_quota":         totalCost,
		"profit_quota":       totalRevenue - totalCost,
		"margin":             0.0,
		"requests":           int64(totalRequests),
		"prompt_tokens":      int64(totalPrompt),
		"completion_tokens":  int64(totalCompletion),
		"cost_configured":    len(cost_setting.Get()) > 0,
	}
	if totalRevenue > 0 {
		summary["margin"] = (totalRevenue - totalCost) / totalRevenue
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"items":           items,
			"summary":         summary,
			"quota_per_unit":  common.QuotaPerUnit,
		},
	})
}

// GetUpstreamCostRatio 返回当前的上游进货价表。
func GetUpstreamCostRatio(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    cost_setting.Get(),
	})
}

// UpdateUpstreamCostRatio 保存上游进货价表（JSON：{"模型名":{"in":0.5,"out":1.5}}，
// 单位 USD / 1M tokens）。成本价与售价解耦，售价调整不影响成本核算。
func UpdateUpstreamCostRatio(c *gin.Context) {
	var req struct {
		Data string `json:"data"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "请求体解析失败"})
		return
	}
	if err := cost_setting.Update(req.Data); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "JSON 格式有误：" + err.Error()})
		return
	}
	if err := model.UpdateOption(cost_setting.UpstreamCostRatioKey, req.Data); err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "已保存"})
}
