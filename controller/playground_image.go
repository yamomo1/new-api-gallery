package controller

import (
	"errors"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relaykit/types"

	"github.com/gin-gonic/gin"
)

// PlaygroundImage 让已登录用户直接调站内图片模型（POST /pg/images/generations）。
//
// 为什么不能让前端直接打 /v1/images/generations：/v1 整组挂的是
// middleware.TokenAuth()，只认 sk- 开头的 API 令牌，会话 access token 会被
// 判为「无效的令牌」。站点创作页是登录态用户、没有 API 令牌，所以要走 /pg
// 前缀 —— GenRelayInfo 靠这个前缀判定 IsPlayground：跳过令牌预扣、按用户
// 额度计费，渠道选择照常（见 relay-router.go 里 /pg/chat/completions）。
//
// 两个照抄但不能改的地方（与 /pg/translate 同源的经验）：
//  1. 这里不要自己调 GenRelayInfo —— Relay 内部会再算一次，提前算的会被丢弃；
//     而且图片请求体是 dto.ImageRequest，手传 nil 会走到默认的
//     GeneralOpenAIRequest 分支，直接报 invalid request type。
//  2. 分组从上下文取（Distribute 已算好），不要再自己解析请求体。
func PlaygroundImage(c *gin.Context) {
	var newAPIError *types.NewAPIError

	defer func() {
		if newAPIError != nil {
			c.JSON(newAPIError.StatusCode, gin.H{
				"error": newAPIError.ToOpenAIError(common.UpstreamAddresses(c)...),
			})
		}
	}()

	useAccessToken := c.GetBool("use_access_token")
	if useAccessToken {
		newAPIError = types.NewError(errors.New(i18n.T(c, i18n.MsgRelayAccessTokenUnsupported)), types.ErrorCodeAccessDenied, types.ErrOptionWithSkipRetry())
		return
	}

	userId := c.GetInt("id")

	// Write user context to ensure acceptUnsetRatio is available
	userCache, err := model.GetUserCache(userId)
	if err != nil {
		newAPIError = types.NewError(err, types.ErrorCodeQueryDataError, types.ErrOptionWithSkipRetry())
		return
	}
	userCache.WriteContext(c)

	tempToken := &model.Token{
		UserId: userId,
		Name:   "playground-image",
		Group:  common.GetContextKeyString(c, constant.ContextKeyUsingGroup),
	}
	if err := middleware.SetupContextForToken(c, tempToken); err != nil {
		newAPIError = types.NewError(err, types.ErrorCodeQueryDataError, types.ErrOptionWithSkipRetry())
		return
	}

	Relay(c, types.RelayFormatOpenAIImage)
}
