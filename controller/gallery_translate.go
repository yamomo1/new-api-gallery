package controller

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service/gallerytranslate"
	"github.com/gin-gonic/gin"
	"github.com/samber/lo"
)

// 翻译相关的 HTTP 状态码：额度不足不复用 4xx 通用码，方便前端区分处理。
const translateStatusLimitReached = http.StatusTooManyRequests
const translateStatusQuotaNeeded = http.StatusPaymentRequired

// translateRequest 是翻译接口与后台自测接口共用的入参。
type translateRequest struct {
	// Text 待翻译的原文
	Text string `json:"text"`
	// Model 自测时可临时换个模型对比效果；普通用户调用时忽略
	Model string `json:"model"`
	// SystemPrompt 自测时可临时替换约束提示词；普通用户调用时忽略
	SystemPrompt string `json:"system_prompt"`
	// UserPromptTemplate 自测时可临时替换原文信封
	UserPromptTemplate string `json:"user_prompt_template"`
}

// GetGalleryTranslateStatus 返回翻译功能的开关、今日用量与付费规则。
//
// 前端靠这份数据在前台显示「今日还剩 x 次 / 超出后每次 x 积分」，
// 所以字段必须对得上 gate 的判定逻辑 —— 两边共用 service 层，不会走偏。
func GetGalleryTranslateStatus(c *gin.Context) {
	userId := c.GetInt("id")
	cfg := gallerytranslate.LoadConfig()
	used, remaining := gallerytranslate.Usage(userId, cfg)

	// 额度余额只在「超额要付费」时才有展示意义，避免无谓的库查询。
	quota := 0
	if cfg.DailyLimit > 0 && cfg.OverageEnabled && cfg.OverageQuota > 0 {
		if q, err := model.GetUserQuota(userId, false); err == nil {
			quota = q
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"enabled":         cfg.Enabled,
			"model":           cfg.Model,
			"daily_limit":     cfg.DailyLimit,
			"used":            used,
			"remaining":       remaining,
			"overage_enabled": cfg.OverageEnabled,
			"overage_quota":   cfg.OverageQuota,
			"max_chars":       cfg.MaxChars,
			"notice":          cfg.Notice,
			"quota":           quota,
			"quota_per_unit":  common.QuotaPerUnit,
		},
	})
}

// GetGalleryTranslateConfig 返回完整配置（含提示词），仅超管。
func GetGalleryTranslateConfig(c *gin.Context) {
	c.Header("Cache-Control", "no-cache")
	c.JSON(http.StatusOK, gin.H{"success": true, "data": gallerytranslate.LoadConfig()})
}

// UpdateGalleryTranslateConfig 保存配置（仅超管）。
// 请求体就是完整的 Config JSON；先校验能解析 + systemPrompt 非空，再落 Option。
func UpdateGalleryTranslateConfig(c *gin.Context) {
	body, err := io.ReadAll(io.LimitReader(c.Request.Body, 512*1024))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "读取请求体失败"})
		return
	}
	raw := strings.TrimSpace(string(body))
	if raw == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "请求体不是合法的 JSON"})
		return
	}
	var parsed map[string]json.RawMessage
	if err := json.Unmarshal([]byte(raw), &parsed); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "请求体不是合法的 JSON"})
		return
	}
	// 故意不校验 systemPrompt 非空 —— 后台「恢复内置」就是把它清空提交过来，
	// LoadConfig 的 normalize 会补回内置提示词。这里卡住等于把那个按钮废掉。
	if err := gallerytranslate.SaveConfig(raw); err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": gallerytranslate.LoadConfig()})
}

// GalleryTranslate 执行一次翻译。
//
// 流程刻意塞在这里而不是前端：prompt 要从后台配置读、次数要服务端统计、
// 超额要扣额度，三件事都不能交给浏览器决定。最后一步才交给 Relay
// —— 和 /pg/chat/completions 走同一条分发链路，用量、日志、计费都不用重写。
func GalleryTranslate(c *gin.Context) {
	userId := c.GetInt("id")
	cfg := gallerytranslate.LoadConfig()
	if !cfg.Enabled {
		writeTranslateError(c, http.StatusForbidden, "translate.disabled")
		return
	}

	var req translateRequest
	if err := common.UnmarshalBodyReusable(c, &req); err != nil {
		writeTranslateError(c, http.StatusBadRequest, "translate.invalid_input")
		return
	}
	text := strings.TrimSpace(req.Text)
	if text == "" {
		writeTranslateError(c, http.StatusBadRequest, "translate.empty_input")
		return
	}
	runes := []rune(text)
	if len(runes) > cfg.MaxChars {
		text = string(runes[:cfg.MaxChars])
	}

	modelName := gallerytranslate.PickModel(userId, cfg)
	gate := gallerytranslate.CheckGate(userId, cfg, modelName)
	if !gate.Allowed {
		switch gate.Result {
		case gallerytranslate.ResultLimited:
			writeTranslateGate(c, translateStatusLimitReached, gate)
		case gallerytranslate.ResultNeedQuota:
			writeTranslateGate(c, translateStatusQuotaNeeded, gate)
		default:
			writeTranslateGate(c, http.StatusBadRequest, gate)
		}
		return
	}

	recordId := model.RecordTranslateUsage(userId, modelName, len(runes), gate.Charged, false, false)

	// 把用量写在响应头里，不要动返回体 ——
	// 返回体必须是标准的 chat completions 结构，前端才不用写两套解析。
	c.Header("X-Translate-Remaining", strconv.Itoa(gate.Remaining))
	c.Header("X-Translate-Used", strconv.Itoa(gate.Used+1))
	c.Header("X-Translate-Charged", strconv.Itoa(gate.Charged))

	request := buildTranslateRequest(cfg, modelName, cfg.SystemPrompt, text)
	runRelay(c, request, modelName, userId)

	// Relay 已经写完响应了，这里按最终状态回填成败；失败则把额外扣的额度退回去。
	if recordId > 0 {
		if c.Writer.Status() < http.StatusBadRequest {
			model.MarkTranslateUsageSuccess(recordId)
		} else if gate.Charged > 0 {
			gallerytranslate.Refund(userId, recordId, gate.Charged)
		}
	}
}

// TestGalleryTranslate 让管理员在后台直接试提示词效果。
//
// 与普通调用的区别：不占每日免费次数、不扣额外额度（is_admin_test），
// 但可以临时换模型/换约束词/换信封 —— 上线新提示词前先在这里跑一遍。
func TestGalleryTranslate(c *gin.Context) {
	userId := c.GetInt("id")
	cfg := gallerytranslate.LoadConfig()

	var req translateRequest
	if err := common.UnmarshalBodyReusable(c, &req); err != nil {
		writeTranslateError(c, http.StatusBadRequest, "translate.invalid_input")
		return
	}
	text := strings.TrimSpace(req.Text)
	if text == "" {
		writeTranslateError(c, http.StatusBadRequest, "translate.empty_input")
		return
	}
	runes := []rune(text)
	if len(runes) > cfg.MaxChars {
		text = string(runes[:cfg.MaxChars])
	}

	systemPrompt := strings.TrimSpace(req.SystemPrompt)
	if systemPrompt == "" {
		systemPrompt = cfg.SystemPrompt
	}
	userTemplate := strings.TrimSpace(req.UserPromptTemplate)
	if userTemplate == "" {
		userTemplate = cfg.UserPromptTemplate
	}

	modelName := strings.TrimSpace(req.Model)
	if modelName == "" {
		modelName = gallerytranslate.PickModel(userId, cfg)
	}
	if modelName == "" {
		gate := gallerytranslate.GateResult{Result: gallerytranslate.ResultNoModel}
		writeTranslateGate(c, http.StatusBadRequest, gate)
		return
	}

	// 自测也要有账可查：不然管理员发现自己被告 White made no sense 时无从追溯。
	recordId := model.RecordTranslateUsage(userId, modelName, len(runes), 0, false, true)

	request := buildTranslateRequestWithTemplate(cfg, modelName, systemPrompt, userTemplate, text)
	runRelay(c, request, modelName, userId)

	if recordId > 0 && c.Writer.Status() < http.StatusBadRequest {
		model.MarkTranslateUsageSuccess(recordId)
	}
}

// buildTranslateRequest 拼出标准的 chat completions 请求体。
func buildTranslateRequest(cfg *gallerytranslate.Config, modelName string, systemPrompt string, text string) dto.Request {
	return buildTranslateRequestWithTemplate(cfg, modelName, systemPrompt, cfg.UserPromptTemplate, text)
}

func buildTranslateRequestWithTemplate(cfg *gallerytranslate.Config, modelName string, systemPrompt string, userTemplate string, text string) dto.Request {
	prompt := gallerytranslate.Config{
		SystemPrompt:       systemPrompt,
		UserPromptTemplate: userTemplate,
	}
	return &dto.GeneralOpenAIRequest{
		Model:  modelName,
		Stream: lo.ToPtr(false),
		Messages: []dto.Message{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: gallerytranslate.BuildUserPrompt(&prompt, text)},
		},
		Temperature: lo.ToPtr(cfg.Temperature),
		N:           lo.ToPtr(1),
	}
}

// replaceRequestBody 把 gin 的请求体换成我们拼好的 chat completions 请求。
//
// 这是整套实现里最关键的一处坑：relay 下游（GetAndValidOpenAIRequest 等）
// 不看 GenRelayInfo 传进去的 request 对象，而是自己 UnmarshalBodyReusable
// 重新解析 c.Request.Body。而缓存是按 KeyBodyStorage 存在 gin 上下文里的
// —— 只换 c.Request.Body 不够，必须连缓存一起换掉，
// 否则下游读到的还是 {text:"..."}，直接报 "model is required"。
func replaceRequestBody(c *gin.Context, request dto.Request) error {
	raw, err := json.Marshal(request)
	if err != nil {
		return err
	}
	c.Request.Body = io.NopCloser(bytes.NewReader(raw))
	c.Request.ContentLength = int64(len(raw))
	if bs, bsErr := common.CreateBodyStorage(raw); bsErr == nil && bs != nil {
		c.Set(common.KeyBodyStorage, bs)
	}
	return nil
}

// runRelay 接上标准的转发链路：换请求体 → 写用户上下文 → 造临时令牌 → Relay。
//
// 两个「照抄但不能改」的地方：
//  1. 这里不要再调 GenRelayInfo —— Relay 内部会自己再调一次，
//     提前算出来的 relayinfo 会被就地丢弃，改什么都没用。
//  2. IsPlayground / RequestURLPath 这些由路径前缀决定的行为也不用管，
//     因为路由本身就挂在 /pg 下（见 relay-router 的注释）。
func runRelay(c *gin.Context, request dto.Request, modelName string, userId int) {
	if err := replaceRequestBody(c, request); err != nil {
		writeTranslateInternalError(c, "marshal request: "+err.Error())
		return
	}

	userCache, err := model.GetUserCache(userId)
	if err != nil {
		writeTranslateInternalError(c, "load user cache: "+err.Error())
		return
	}
	userCache.WriteContext(c)

	tempToken := &model.Token{
		UserId: userId,
		Name:   translateTokenName,
		Group:  common.GetContextKeyString(c, constant.ContextKeyUsingGroup),
	}
	if err := middleware.SetupContextForToken(c, tempToken); err != nil {
		writeTranslateInternalError(c, "setup token: "+err.Error())
		return
	}

	Relay(c, types.RelayFormatOpenAI)
}

func writeTranslateError(c *gin.Context, status int, message string) {
	c.JSON(status, gin.H{"success": false, "message": message})
}

// writeTranslateInternalError 服务端自己的锅：详情进日志，用户只看到通用的「稍后再试」。
//
// 曾经这里会把 build_request_failed 之类的机器码直接塞进 message，
// 前端又原样拿去查 i18n，查不到就把英文 key 弹给用户 —— 等于把内部实现漏出去了。
func writeTranslateInternalError(c *gin.Context, detail string) {
	common.SysError("gallery translate: " + detail)
	c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "translate.failed"})
}

func writeTranslateGate(c *gin.Context, status int, gate gallerytranslate.GateResult) {
	c.JSON(status, gin.H{
		"success": false,
		"message": gate.Message,
		"data": gin.H{
			"result":          gate.Result,
			"used":            gate.Used,
			"limit":           gate.Limit,
			"remaining":       gate.Remaining,
			"overage_enabled": gate.IsOverage,
		},
	})
}

var translateTokenName = "prompt-translate"
