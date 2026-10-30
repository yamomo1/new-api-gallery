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
			c.Header("Cache-Control", "no-cache")
			// 服务端按路径注入 title / description / canonical / OG / JSON-LD：
			// 大模型爬虫不执行 JS，只能看到这里吐出去的 HTML。
			c.Data(http.StatusOK, "text/html; charset=utf-8", seo.InjectIndex(assets.IndexPage, c.Request.URL.Path))
		},
	)
}
