package router

import (
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"

	"github.com/gin-contrib/gzip"
	"github.com/gin-gonic/gin"
)

// 二开：在 /studio/ 下托管画布工作台（infinite-canvas 的 Vite 产物）
//
// 画布前端是纯静态站点（上游镜像是 nginx:alpine + dist），没有后端进程，
// 也不需要第二个域名/证书/反代。这里直接由 New API 自己把文件发出去：
//
//	· 宿主机  deploy/data/studio/  →  容器内 /data/studio（deploy/data 已挂载到 /data）
//	· 对外    https://<主站域名>/studio/
//	· /api、/v1 本来就在同域，画布登录、存画布、调模型都不用再配
//
// 目录不存在时**不注册任何路由**，请求照旧回落给主站 SPA（不影响现网）。
// 目录可用 CANVAS_STUDIO_DIR 覆盖。
const defaultStudioDir = "/data/studio"

func studioDir() string {
	if v := strings.TrimSpace(os.Getenv("CANVAS_STUDIO_DIR")); v != "" {
		return v
	}
	return defaultStudioDir
}

// SetStudioRouter 注册 /studio 静态路由（幂等：目录不存在则什么都不做）
func SetStudioRouter(router *gin.Engine) {
	abs, err := filepath.Abs(studioDir())
	if err != nil {
		return
	}
	indexPath := filepath.Join(abs, "index.html")
	if fi, err := os.Stat(indexPath); err != nil || fi.IsDir() {
		// 没上传画布产物：保持原样（/studio 由主站 SPA 处理）
		return
	}

	serveIndex := func(c *gin.Context) {
		c.Header("Cache-Control", "no-cache")
		c.File(indexPath)
	}

	serve := func(c *gin.Context) {
		upath := c.Param("filepath")
		// Gin 的通配符带前导斜杠；path.Clean 同时挡掉 ../ 穿越
		clean := path.Clean("/" + strings.TrimPrefix(upath, "/"))
		full := filepath.Join(abs, filepath.FromSlash(clean))
		if fi, err := os.Stat(full); err == nil && !fi.IsDir() {
			if strings.Contains(clean, "/assets/") {
				// Vite 产物带内容 hash，可长缓存
				c.Header("Cache-Control", "public, max-age=31536000, immutable")
			} else {
				c.Header("Cache-Control", "no-cache")
			}
			c.File(full)
			return
		}
		// 画布是单页应用，深链（/studio/canvas?open=1）一律回落到 index.html
		serveIndex(c)
	}

	router.GET("/studio", func(c *gin.Context) {
		c.Redirect(http.StatusFound, "/studio/")
	})
	// 主 JS 有 3MB（gzip 后约 1MB），走压缩；产物带 hash，浏览器侧另有长缓存
	studio := router.Group("/studio", gzip.Gzip(gzip.DefaultCompression))
	studio.GET("/*filepath", serve)
	studio.HEAD("/*filepath", serve)
}
