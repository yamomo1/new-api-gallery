package controller

import (
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/shopspring/decimal"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/service/alipay"
	"github.com/QuantumNous/new-api/setting"

	"github.com/gin-gonic/gin"
)

/*
支付宝开放平台官方直连（不经过易支付等聚合网关）。

链路：
1. 前端 POST /api/user/alipay/pay → 建 pending 订单，返回收银台 URL 或二维码内容
2. 用户在支付宝完成支付 → 支付宝异步 POST notify_url（/api/user/alipay/notify）→ 验签入账
3. 浏览器同步跳回 return_url（/api/user/alipay/return）→ 二次查单兜底（通知丢失时补单）后跳回钱包页
*/

// AlipayPayRequest 发起支付宝支付
type AlipayPayRequest struct {
	Amount int64 `json:"amount"`
	// Mode 可选：page / wap / qr，留空用后台配置（移动端会在 page 配置下自动降级为 wap）
	Mode string `json:"mode"`
}

func alipayConfig() *alipay.Config {
	s := setting.GetAlipaySetting()
	callBackAddress := strings.TrimRight(service.GetCallbackAddress(), "/")
	notifyURL := strings.TrimSpace(s.NotifyUrl)
	if notifyURL == "" {
		notifyURL = callBackAddress + "/api/user/alipay/notify"
	}
	returnURL := strings.TrimSpace(s.ReturnUrl)
	if returnURL == "" {
		returnURL = callBackAddress + "/api/user/alipay/return"
	}
	return alipay.NewConfig(s.AppId, s.PrivateKey, s.PublicKeyPem, s.GatewayURL(), notifyURL, returnURL)
}

// alipayMinTopUp 官方支付宝的最小充值额（取全局与专用配置的较大值）
func alipayMinTopUp() int64 {
	minTopUp := getMinTopup()
	if configured := setting.GetAlipaySetting().MinTopUp; int64(configured) > minTopUp {
		minTopUp = int64(configured)
	}
	return minTopUp
}

// resolveAlipayMode 决定本次使用哪个支付产品
func resolveAlipayMode(requestedMode string, userAgent string) string {
	switch strings.ToLower(strings.TrimSpace(requestedMode)) {
	case setting.AlipayModePage:
		return setting.AlipayModePage
	case setting.AlipayModeWap:
		return setting.AlipayModeWap
	case setting.AlipayModeQr:
		return setting.AlipayModeQr
	}

	configured := setting.GetAlipaySetting().NormalizedMode()
	if configured == setting.AlipayModePage && isMobileUserAgent(userAgent) {
		// 电脑网站支付在手机上体验很差，自动降到 H5 收银台
		return setting.AlipayModeWap
	}
	return configured
}

func isMobileUserAgent(userAgent string) bool {
	lowered := strings.ToLower(userAgent)
	for _, keyword := range []string{"iphone", "android", "ipad", "ipod", "mobile", "harmonyos"} {
		if strings.Contains(lowered, keyword) {
			return true
		}
	}
	return false
}

// RequestAlipayPay 创建支付宝订单并返回收银台地址 / 二维码内容
func RequestAlipayPay(c *gin.Context) {
	if !isAlipayTopUpEnabled() {
		paymentError(c, common.NewMessage("Alipay payment is not enabled or not configured yet"))
		return
	}

	var req AlipayPayRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		paymentError(c, common.NewMessage("Invalid parameters"))
		return
	}
	if req.Amount < alipayMinTopUp() {
		paymentError(c, common.NewMessage("Top-up amount cannot be less than {{min}}", map[string]any{"min": alipayMinTopUp()}))
		return
	}

	userId := c.GetInt("id")
	if rejectInvalidTopUpQuota(c, userId, req.Amount) {
		return
	}

	group, err := model.GetUserGroup(userId, true)
	if err != nil {
		paymentError(c, common.NewMessage("Failed to get the user group"))
		return
	}
	payMoney := getPayMoney(req.Amount, group)
	if payMoney < 0.01 {
		paymentError(c, common.NewMessage("Payment amount is too low"))
		return
	}

	s := setting.GetAlipaySetting()
	mode := resolveAlipayMode(req.Mode, c.Request.UserAgent())

	tradeNo := fmt.Sprintf("ALI%dNO%s%d", userId, common.GetRandomString(6), time.Now().Unix())
	order := alipay.Order{
		OutTradeNo:     tradeNo,
		Subject:        fmt.Sprintf("%s %d", s.EffectiveDisplayName(), req.Amount),
		TotalAmount:    strconv.FormatFloat(payMoney, 'f', 2, 64),
		TimeoutExpress: s.EffectiveTimeoutExpress(),
	}
	client := alipayConfig()

	var (
		payURL string
		qrCode string
	)
	switch mode {
	case setting.AlipayModeQr:
		qrCode, err = client.Precreate(c.Request.Context(), order)
	case setting.AlipayModeWap:
		payURL, err = client.WapPayURL(order)
	default:
		payURL, err = client.PagePayURL(order)
	}
	if err != nil {
		logger.LogError(c.Request.Context(), common.LogText(
			"Alipay failed to create order user_id=%d trade_no=%s mode=%s amount=%d money=%.2f error=%q",
			userId, tradeNo, mode, req.Amount, payMoney, err.Error(),
		))
		paymentError(c, common.NewMessage("Failed to start payment"))
		return
	}

	topUp := &model.TopUp{
		UserId:          userId,
		Amount:          req.Amount,
		Money:           payMoney,
		TradeNo:         tradeNo,
		PaymentMethod:   model.PaymentMethodAlipay,
		PaymentProvider: model.PaymentProviderAlipay,
		CreateTime:      time.Now().Unix(),
		Status:          common.TopUpStatusPending,
	}
	if err := topUp.Insert(); err != nil {
		logger.LogError(c.Request.Context(), common.LogText(
			"Alipay failed to create top-up order user_id=%d trade_no=%s error=%q", userId, tradeNo, err.Error(),
		))
		paymentError(c, common.NewMessage("Failed to create order"))
		return
	}

	logger.LogInfo(c.Request.Context(), common.LogText(
		"Alipay top-up order created user_id=%d trade_no=%s mode=%s amount=%d money=%.2f",
		userId, tradeNo, mode, req.Amount, payMoney,
	))

	c.JSON(http.StatusOK, gin.H{
		"message": "success",
		"data": gin.H{
			"mode":     mode,
			"trade_no": tradeNo,
			"pay_url":  payURL,
			"qr_code":  qrCode,
			"money":    order.TotalAmount,
		},
	})
}

// collectAlipayParams 支付宝通知为 POST 表单，也兼容 GET（部分调试场景）
func collectAlipayParams(c *gin.Context) map[string]string {
	source := c.Request.URL.Query()
	if c.Request.Method == http.MethodPost {
		if err := c.Request.ParseForm(); err == nil && len(c.Request.PostForm) > 0 {
			source = c.Request.PostForm
		}
	}
	params := make(map[string]string, len(source))
	for key := range source {
		params[key] = source.Get(key)
	}
	return params
}

func writePlain(c *gin.Context, text string) {
	c.Header("Content-Type", "text/plain; charset=utf-8")
	_, _ = c.Writer.Write([]byte(text))
}

// AlipayNotify 支付宝异步通知：验签 → 校验金额 → 入账
func AlipayNotify(c *gin.Context) {
	if !isAlipayTopUpEnabled() {
		logger.LogWarn(c.Request.Context(), common.LogText(
			"Alipay notify rejected reason=disabled path=%q client_ip=%s", c.Request.RequestURI, c.ClientIP(),
		))
		writePlain(c, "fail")
		return
	}

	params := collectAlipayParams(c)
	if len(params) == 0 {
		writePlain(c, "fail")
		return
	}
	logger.LogInfo(c.Request.Context(), common.LogText(
		"Alipay notify received client_ip=%s params=%q", c.ClientIP(), common.GetJsonString(params),
	))

	s := setting.GetAlipaySetting()
	if err := alipay.Verify(params, s.PublicKeyPem); err != nil {
		logger.LogWarn(c.Request.Context(), common.LogText(
			"Alipay notify signature verification failed trade_no=%s client_ip=%s error=%q",
			params["out_trade_no"], c.ClientIP(), err.Error(),
		))
		writePlain(c, "fail")
		return
	}
	if appId := params["app_id"]; appId != "" && appId != s.AppId {
		logger.LogWarn(c.Request.Context(), common.LogText(
			"Alipay notify app_id mismatch trade_no=%s expected=%q actual=%q",
			params["out_trade_no"], s.AppId, appId,
		))
		writePlain(c, "fail")
		return
	}

	tradeStatus := params["trade_status"]
	tradeNo := params["out_trade_no"]
	if tradeStatus != alipay.TradeStatusSuccess && tradeStatus != alipay.TradeStatusFinished {
		logger.LogInfo(c.Request.Context(), common.LogText(
			"Alipay notify ignored trade_no=%s trade_status=%s", tradeNo, tradeStatus,
		))
		writePlain(c, "success")
		return
	}

	paidAmount, err := decimal.NewFromString(params["total_amount"])
	if err != nil {
		logger.LogWarn(c.Request.Context(), common.LogText(
			"Alipay notify invalid total_amount trade_no=%s raw=%q", tradeNo, params["total_amount"],
		))
		writePlain(c, "fail")
		return
	}

	// 进程内锁只是优化；正确性由 RechargeAlipay 的行锁 + 事务内状态校验保证
	LockOrder(tradeNo)
	defer UnlockOrder(tradeNo)

	alreadyDone, err := model.RechargeAlipay(tradeNo, paidAmount, params["trade_no"], c.ClientIP())
	if err != nil {
		switch {
		case errors.Is(err, model.ErrTopUpNotFound):
			logger.LogWarn(c.Request.Context(), common.LogText(
				"Alipay notify order not found trade_no=%s", tradeNo,
			))
		case errors.Is(err, model.ErrPaymentMethodMismatch):
			logger.LogWarn(c.Request.Context(), common.LogText(
				"Alipay notify provider mismatch trade_no=%s", tradeNo,
			))
		case errors.Is(err, model.ErrAlipayAmountMismatch):
			logger.LogError(c.Request.Context(), common.LogText(
				"Alipay notify amount mismatch trade_no=%s paid=%s", tradeNo, params["total_amount"],
			))
		case errors.Is(err, model.ErrTopUpStatusInvalid):
			logger.LogWarn(c.Request.Context(), common.LogText(
				"Alipay notify order status invalid trade_no=%s", tradeNo,
			))
		default:
			logger.LogError(c.Request.Context(), common.LogText(
				"Alipay notify processing failed trade_no=%s error=%q", tradeNo, err.Error(),
			))
		}
		writePlain(c, "fail")
		return
	}
	if alreadyDone {
		logger.LogInfo(c.Request.Context(), common.LogText(
			"Alipay duplicate notify ignored trade_no=%s", tradeNo,
		))
	}
	writePlain(c, "success")
}

// AlipayReturn 用户支付完成后浏览器同步跳回：查单兜底 + 跳回钱包页
func AlipayReturn(c *gin.Context) {
	target := paymentReturnPath("/wallet") + "?pay=alipay"
	if !isAlipayTopUpEnabled() {
		c.Redirect(http.StatusFound, target+"&status=disabled")
		return
	}

	params := collectAlipayParams(c)
	if len(params) > 0 {
		if err := alipay.Verify(params, setting.GetAlipaySetting().PublicKeyPem); err != nil {
			logger.LogWarn(c.Request.Context(), common.LogText(
				"Alipay return signature verification failed trade_no=%s error=%q",
				params["out_trade_no"], err.Error(),
			))
		}
	}

	tradeNo := strings.TrimSpace(params["out_trade_no"])
	if tradeNo == "" {
		c.Redirect(http.StatusFound, target)
		return
	}

	// 通知可能还没到（或丢了），这里主动查单补一次；失败不阻塞跳转
	if result, err := alipayConfig().QueryTrade(c.Request.Context(), tradeNo); err == nil &&
		(result.TradeStatus == alipay.TradeStatusSuccess || result.TradeStatus == alipay.TradeStatusFinished) {
		paidAmount, amountErr := decimal.NewFromString(result.TotalAmount)
		if amountErr == nil {
			LockOrder(tradeNo)
			if _, rechargeErr := model.RechargeAlipay(tradeNo, paidAmount, result.TradeNo, c.ClientIP()); rechargeErr != nil &&
				!errors.Is(rechargeErr, model.ErrTopUpStatusInvalid) {
				logger.LogWarn(c.Request.Context(), common.LogText(
					"Alipay return reconcile failed trade_no=%s error=%q", tradeNo, rechargeErr.Error(),
				))
			}
			UnlockOrder(tradeNo)
		}
	}

	redirect := target + "&trade_no=" + url.QueryEscape(tradeNo)
	c.Redirect(http.StatusFound, redirect)
}

// buildAlipayPayMethod 支付方式列表里的一条（供 /api/user/topup/info 使用）
func buildAlipayPayMethod() map[string]string {
	s := setting.GetAlipaySetting()
	return map[string]string{
		"name":      s.EffectiveDisplayName(),
		"icon":      "SiAlipay",
		"type":      setting.PaymentMethodTypeAlipayOfficial,
		"color":     "#1677FF",
		"min_topup": strconv.FormatInt(alipayMinTopUp(), 10),
	}
}
