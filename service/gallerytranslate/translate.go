/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

package gallerytranslate

import (
	"regexp"
	"strings"

	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
)

// 配额判定的四种结果
const (
	ResultOK = "ok"
	// ResultLimited 超出今日免费次数且后台不允许付费继续
	ResultLimited = "limited"
	// ResultNeedQuota 超出免费次数（可以付费继续），但额度不够这一次
	ResultNeedQuota = "need_quota"
	// ResultNoModel 找不到可用模型 —— 要么后台没配，要么没启用任何渠道
	ResultNoModel = "no_model"
)

// GateResult 是放行与否的结论，附带要展示给用户的信息。
type GateResult struct {
	Allowed bool   `json:"allowed"`
	Result  string `json:"result"`
	Message string `json:"message"`
	// Used / Remaining 用于「今日还能用几次」提示；Remaining 为 -1 表示不限。
	Used      int  `json:"used"`
	Limit     int  `json:"limit"`
	Remaining int  `json:"remaining"`
	Charged   int  `json:"charged"`
	IsOverage bool `json:"is_overage"`
	Model     string
}

// ChatModelHint 用来从用户可用模型里挑一个像样的对话模型。
// 顺序很重要：先匹配更像 chat 模型的，避免把 rerank / embedding 拿来翻译。
var ChatModelHint = regexp.MustCompile(`(?i)chat|gpt|claude|gemini|glm|qwen|deepseek|mistral|kimi|doubao|hunyuan|ernie`)

// PickModel 决定这次翻译走哪个模型。
//
// 优先级：后台指定的 Model > 用户可用模型里挑一个像对话模型的 > 第一个可用模型。
// 后台留空时不要直接报错 —— 管理员还没来得及配，用户也不该看到「翻译不可用」。
func PickModel(userId int, cfg *Config) string {
	if cfg == nil {
		return ""
	}
	if strings.TrimSpace(cfg.Model) != "" {
		return strings.TrimSpace(cfg.Model)
	}
	return pickFromUserModels(userId)
}

func pickFromUserModels(userId int) string {
	user, err := model.GetUserCache(userId)
	if err != nil {
		return ""
	}
	groups := service.GetUserUsableGroups(user.Group)
	names := make([]string, 0, len(groups))
	for g := range groups {
		names = append(names, g)
	}
	models := service.GetGroupsEnabledModels(names)
	if len(models) == 0 {
		return ""
	}
	for _, m := range models {
		if ChatModelHint.MatchString(m) {
			return m
		}
	}
	return models[0]
}

// gateMessage 把判定结果翻成用户可见文案。
// 这里一律返回 i18n key（如 translate.limited），由前端按语言包渲染 ——
// 服务端不掺和实际文案，改提示不用重新编译。
func gateMessage(res *GateResult) string {
	switch res.Result {
	case ResultLimited:
		return "translate.limited"
	case ResultNeedQuota:
		return "translate.need_quota"
	case ResultNoModel:
		return "translate.no_model"
	}
	return ""
}

// CheckGate 判断这次翻译能不能放行，并在需要付费时扣额度。
//
// 计数口径：
//   - DailyLimit 为 0 → 不限次，永不判 ResultLimited
//   - 超额后允许付费（OverageEnabled）→ 检查余额够不够这一次 OverageQuota，
//     够就扣掉并放行；不够就 ResultNeedQuota
//   - 超额后不允许付费 → ResultLimited
//
// 这里刻意先扣钱再调模型：反过来做会有并发窗口 ——
// 两个请求同时检查都是「还差 1 次」，然后都通过了。
func CheckGate(userId int, cfg *Config, modelName string) GateResult {
	res := GateResult{
		Result:    ResultOK,
		Remaining: -1,
		Model:     modelName,
	}
	if cfg == nil {
		res.Result = ResultNoModel
		res.Message = gateMessage(&res)
		return res
	}
	if modelName == "" {
		res.Result = ResultNoModel
		res.Message = gateMessage(&res)
		return res
	}

	res.Limit = cfg.DailyLimit
	used, err := model.CountTranslateUsageToday(userId)
	if err != nil {
		// 记账表出问题不应该让整个功能挂掉，按 0 次算继续
		used = 0
	}
	res.Used = int(used)

	if cfg.DailyLimit > 0 {
		remaining := cfg.DailyLimit - int(used)
		if remaining < 0 {
			remaining = 0
		}
		res.Remaining = remaining
	}

	if cfg.DailyLimit <= 0 || int(used) < cfg.DailyLimit {
		res.Allowed = true
		return res
	}

	// —— 走到这里说明免费次数已经用完 ——
	res.IsOverage = true
	if !cfg.OverageEnabled {
		res.Result = ResultLimited
		res.Message = gateMessage(&res)
		return res
	}
	cost := cfg.OverageQuota
	if cost <= 0 {
		// 管理员开了「超额继续」却没填单价，视为仍限量，避免变成无限免费翻译
		res.Result = ResultLimited
		res.Message = gateMessage(&res)
		return res
	}
	quota, err := model.GetUserQuota(userId, true)
	if err != nil || quota < cost {
		res.Result = ResultNeedQuota
		res.Message = gateMessage(&res)
		return res
	}
	if err := model.DecreaseUserQuota(userId, cost, true); err != nil {
		res.Result = ResultNeedQuota
		res.Message = gateMessage(&res)
		return res
	}
	res.Charged = cost
	res.Allowed = true
	return res
}

// Refund 把额外扣的额度退给用户，并抹掉记录上的扣费金额。
func Refund(userId int, recordId int64, amount int) {
	if recordId <= 0 || amount <= 0 {
		return
	}
	model.ClearTranslateCharge(recordId)
	_ = model.IncreaseUserQuota(userId, amount, true)
}

// Usage 返回某个用户今天的用量，供 status 接口与前台展示使用。
func Usage(userId int, cfg *Config) (used int, remaining int) {
	count, err := model.CountTranslateUsageToday(userId)
	if err != nil {
		count = 0
	}
	used = int(count)
	remaining = -1
	if cfg != nil && cfg.DailyLimit > 0 {
		remaining = cfg.DailyLimit - used
		if remaining < 0 {
			remaining = 0
		}
	}
	return
}
