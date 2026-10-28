package controller

import (
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
)

// GetCanvasSession 给画布工作台下发 OpenAI 兼容凭证。
//
// 画布是独立部署的前端，用户在里面聊天/生图时不应该再手动创建 sk- 令牌。
// 这里用登录态自动获取（或创建）该用户的「Canvas Studio」专用令牌，
// 前端拿到 base_url + token 后直接调 /v1/*，用量照常计入用户自己的额度。
//
// GET /api/canvas/v1/session
func GetCanvasSession(c *gin.Context) {
	userId := c.GetInt("id")
	token, err := model.GetOrCreateCanvasToken(userId)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	// 优先用「浏览器实际访问到的地址」——反代后仍能拿到真实域名；
	// 请求没带 Host 时才退回后台配置的站点地址。
	host := c.Request.Host
	if forwarded := strings.TrimSpace(strings.Split(c.GetHeader("X-Forwarded-Host"), ",")[0]); forwarded != "" {
		host = forwarded
	}
	scheme := "http"
	if c.Request.TLS != nil || strings.EqualFold(strings.TrimSpace(strings.Split(c.GetHeader("X-Forwarded-Proto"), ",")[0]), "https") {
		scheme = "https"
	}
	baseUrl := ""
	if host != "" {
		baseUrl = scheme + "://" + host
	} else {
		baseUrl = strings.TrimRight(strings.TrimSpace(system_setting.ServerAddress), "/")
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"token":    "sk-" + token.Key,
			"base_url": baseUrl + "/v1",
		},
	})
}
