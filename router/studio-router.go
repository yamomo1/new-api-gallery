package router

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"io/fs"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"

	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/studio"
	"github.com/gin-contrib/gzip"
	"github.com/gin-gonic/gin"
)

// 二开：在 /studio/ 下托管画布工作台（infinite-canvas 的 Vite 产物）
//
// 画布前端是纯静态站点（上游镜像是 nginx:alpine + dist），没有后端进程，
// 也不需要第二个域名/证书/反代。这里直接由 New API 把文件发出去：
//
//	· 产物      编进二进制（studio/dist，由 scripts/sync-studio.sh 同步）
//	· 对外      https://<主站域名>/studio/
//	· /api、/v1 本来就在同域，画布登录、存画布、调模型都不用再配
//
// 这样一来「升级 New API」就等于「升级画布」，不会出现镜像升了、画布还是旧的。
// 想临时换画布而不重建镜像：设 CANVAS_STUDIO_DIR 指向一个含 index.html 的目录即可，
// 磁盘版优先于内置版（显式设置才算，全程不设就是纯内置）。
//
// 两者都取不到时不注册任何路由，请求照旧回落给主站 SPA（对现网零影响）。
func SetStudioRouter(router *gin.Engine) {
	fsys, origin := studioAssets()
	if fsys == nil {
		return
	}

	index, err := fs.ReadFile(fsys, "index.html")
	if err != nil {
		// 产物不完整：当作没有画布，别让主站跟着挂
		logger.LogWarn(context.Background(), "画布工作台：产物里读不到 index.html，已跳过 /studio 路由")
		return
	}
	indexETag := etagOf(index)

	serveIndex := func(c *gin.Context) {
		c.Header("Cache-Control", "no-cache")
		c.Header("ETag", indexETag)
		if etagMatched(c, indexETag) {
			c.Status(http.StatusNotModified)
			return
		}
		c.Data(http.StatusOK, "text/html; charset=utf-8", index)
	}

	serve := func(c *gin.Context) {
		// Gin 的通配符带前导斜杠；path.Clean 挡掉 ../ 穿越，fs 自身还会再校验一次
		clean := path.Clean("/" + strings.TrimPrefix(c.Param("filepath"), "/"))
		name := strings.TrimPrefix(clean, "/")

		if name != "" && name != "index.html" {
			if data, err := fs.ReadFile(fsys, name); err == nil {
				et := etagOf(data)
				if isImmutableAsset(clean) {
					// Vite 产物文件名带内容 hash，内容变文件名必变，可长缓存
					c.Header("Cache-Control", "public, max-age=31536000, immutable")
				} else {
					// icons/、config.js 这类名字固定，必须每次回源验证
					c.Header("Cache-Control", "no-cache")
				}
				c.Header("ETag", et)
				if etagMatched(c, et) {
					c.Status(http.StatusNotModified)
					return
				}
				c.Data(http.StatusOK, contentTypeOf(name, data), data)
				return
			}
		}
		// 画布是单页应用，深链（/studio/canvas?open=1）一律回落到 index.html
		serveIndex(c)
	}

	router.GET("/studio", func(c *gin.Context) {
		c.Redirect(http.StatusFound, "/studio/")
	})
	// 主 JS 3MB（gzip 后约 1MB），走压缩；产物带 hash，浏览器侧另有长缓存
	group := router.Group("/studio", gzip.Gzip(gzip.DefaultCompression))
	group.GET("/*filepath", serve)
	group.HEAD("/*filepath", serve)

	if bi, ok := studio.ReadBuildInfo(fsys); ok {
		logger.LogInfo(context.Background(), "画布工作台已启用：/studio/（来源 "+origin+"，版本 "+bi.Summary()+"）")
	} else {
		logger.LogInfo(context.Background(), "画布工作台已启用：/studio/（来源 "+origin+"）")
	}
}

// studioAssets 决定从哪儿取产物：
//  1. CANVAS_STUDIO_DIR 显式指定且目录里有 index.html → 用磁盘（临时替换，不重建镜像）
//  2. 否则用编进二进制的那份 → 升级 New API 即升级画布
//
// 第二个返回值是给日志看的来源描述。
func studioAssets() (fs.FS, string) {
	if dir := strings.TrimSpace(os.Getenv("CANVAS_STUDIO_DIR")); dir != "" {
		if abs, err := filepath.Abs(dir); err == nil {
			if fi, err := os.Stat(filepath.Join(abs, "index.html")); err == nil && !fi.IsDir() {
				return os.DirFS(abs), "磁盘 " + abs
			}
			logger.LogWarn(context.Background(), "画布工作台：CANVAS_STUDIO_DIR="+abs+" 里没有 index.html，回退到内置版本")
		}
	}
	if sub, ok := studio.DistFS(); ok {
		return sub, "内置"
	}
	return nil, ""
}

// isImmutableAsset：只有 /assets/ 下是带内容 hash 的，可以无限期缓存
func isImmutableAsset(clean string) bool {
	return strings.HasPrefix(clean, "/assets/")
}

// contentTypeOf 显式列出常见类型，不依赖 mime.TypeByExtension。
// Windows 上 Go 会去读注册表，.js 有可能被映射成 text/plain，
// 那样 <script type="module"> 会被浏览器直接拒绝执行，必须自己定死。
func contentTypeOf(name string, data []byte) string {
	switch strings.ToLower(path.Ext(name)) {
	case ".html":
		return "text/html; charset=utf-8"
	case ".js", ".mjs":
		return "text/javascript; charset=utf-8"
	case ".css":
		return "text/css; charset=utf-8"
	case ".json", ".map":
		return "application/json; charset=utf-8"
	case ".svg":
		return "image/svg+xml"
	case ".png":
		return "image/png"
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".webp":
		return "image/webp"
	case ".ico":
		return "image/x-icon"
	case ".woff":
		return "font/woff"
	case ".woff2":
		return "font/woff2"
	case ".ttf":
		return "font/ttf"
	case ".txt":
		return "text/plain; charset=utf-8"
	}
	return http.DetectContentType(data)
}

func etagOf(data []byte) string {
	sum := sha256.Sum256(data)
	return `"` + hex.EncodeToString(sum[:16]) + `"`
}

func etagMatched(c *gin.Context, etag string) bool {
	inm := c.GetHeader("If-None-Match")
	if inm == "" || etag == "" {
		return false
	}
	for _, part := range strings.Split(inm, ",") {
		part = strings.TrimSpace(part)
		// 兼容弱校验前缀
		part = strings.TrimPrefix(part, "W/")
		if part == etag || part == "*" {
			return true
		}
	}
	return false
}
