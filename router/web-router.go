package router

import (
	"embed"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/controller"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/service/seo"
	"github.com/gin-contrib/gzip"
	"github.com/gin-gonic/gin"
)

// WebAssets holds the embedded dashboard frontend assets.
type WebAssets struct {
	BuildFS   embed.FS
	IndexPage []byte
}

// knownSpaSegments 是前端（TanStack Router, web/src/routeTree.gen.ts）的
// 全部一级路由段。命中才当作合法 SPA 深链返回 200 + index.html；
// 其余一律返回 404（仍吐 index.html 供客户端路由渲染自己的 404 页），
// 避免任意路径被当软 404 收录、浪费爬取预算。
// ⚠️ 前端新增公开路由时必须同步更新本集合。
var knownSpaSegments = map[string]bool{
	"canvas": true, "privacy-policy": true, "user-agreement": true,
	"forgot-password": true, "oauth": true, "otp": true, "register": true,
	"reset": true, "sign-in": true, "sign-up": true,
	"401": true, "403": true, "404": true, "500": true, "503": true,
	"chat2link": true, "my-canvases": true, "system-settings": true,
	"workspace": true, "about": true, "pricing": true, "prompt-gallery": true,
	"rankings": true, "setup": true, "user": true, "keys": true, "models": true,
	"my-works": true, "playground": true, "profile": true, "profit": true,
	"redemption-codes": true, "security": true, "subscriptions": true,
	"wallet": true, "users": true, "billing": true, "content": true,
	"storage": true, "translate": true, "watermark": true,
	"gallery-presets": true, "operations": true, "request-policies": true,
	"seo": true, "site": true, "task-plugins": true, "usage-logs": true,
	"auth": true, "admin": true, "channels": true, "dashboard": true,
}

// isKnownSpaPath 判断一个路径是否对应前端真实路由（允许深链子路径）。
func isKnownSpaPath(path string) bool {
	if path == "/" {
		return true
	}
	seg := strings.TrimPrefix(path, "/")
	if i := strings.IndexByte(seg, '/'); i >= 0 {
		seg = seg[:i]
	}
	return knownSpaSegments[seg]
}

func SetWebRouter(router *gin.Engine, assets WebAssets, pluginDispatcher gin.HandlerFunc) {
	frontendFS := common.EmbedFolder(assets.BuildFS, "web/dist")
	compress := gzip.Gzip(gzip.DefaultCompression)

	// SEO 入口文件：由 SeoConfig 动态生成，必须注册在 NoRoute 之前，
	// 否则会被 SPA 兜底吞掉（返回一张 HTML 给爬虫，等于没写）。
	router.GET("/robots.txt", controller.GetRobotsTxt)
	router.GET("/sitemap.xml", controller.GetSitemapXML)
	router.GET("/llms.txt", controller.GetLLMsTxt)

	router.NoRoute(
		pluginDispatcher,
		middleware.RouteTag("web"),
		func(c *gin.Context) {
			// ServeFrontendFiles sends build files already compressed.
			if !frontendFS.Exists("/", c.Request.URL.Path) {
				compress(c)
			}
		},
		middleware.AccessTokenAudit(),
		middleware.GlobalWebRateLimit(frontendFS),
		middleware.Cache(),
		middleware.ServeFrontendFiles(frontendFS),
		func(c *gin.Context) {
			if strings.HasPrefix(c.Request.RequestURI, "/v1") || strings.HasPrefix(c.Request.RequestURI, "/api") || strings.HasPrefix(c.Request.RequestURI, "/assets") {
				controller.RelayNotFound(c)
				return
			}
			// 非前端真实路由：返回 404 + index.html（客户端路由会渲染自己的 404 页），
			// 不再对所有随机路径吐 200 可索引页（软 404 修复）。
			if !isKnownSpaPath(c.Request.URL.Path) {
				c.Header("Cache-Control", "no-store")
				injection := seo.InjectIndex(assets.IndexPage, c.Request.URL.Path)
				c.Data(http.StatusNotFound, "text/html; charset=utf-8", injection.HTML)
				return
			}
			c.Header("Cache-Control", "no-cache")
			// 服务端按路径注入 title / description / canonical / OG / JSON-LD：
			// 大模型爬虫不执行 JS，只能看到这里吐出去的 HTML。
			// 详情页（/prompt-gallery/:id）会额外查库拿该条的标题、封面与提示词正文；
			// 记录不存在时返回 404，让搜索引擎正确下架而不是索引一张空壳页。
			injection := seo.InjectIndex(assets.IndexPage, c.Request.URL.Path)
			c.Data(injection.Status, "text/html; charset=utf-8", injection.HTML)
		},
	)
}
