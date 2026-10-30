package middleware

import (
	"strings"

	"github.com/gin-gonic/gin"
)

func Cache() func(c *gin.Context) {
	return func(c *gin.Context) {
		path := c.Request.URL.Path
		switch {
		case path == "/":
			c.Header("Cache-Control", "no-cache")
		case isHashedAsset(path):
			// 构建产物带内容指纹（index.b9717a786c.js 这种），内容一变文件名就变，
			// 所以可以放心让浏览器/CDN 长期缓存 —— 之前只给一周，回访用户仍要
			// 重新校验，白白多一轮 RTT。
			c.Header("Cache-Control", "public, max-age=31536000, immutable")
		default:
			// 未带指纹的静态文件（logo、视频、图片）保守给一周。
			c.Header("Cache-Control", "max-age=604800")
		}
		c.Header("Cache-Version", "b688f2fb5be447c25e5aa3bd063087a83db32a288bf6a4f35f2d8db310e40b14")
		c.Next()
	}
}

// isHashedAsset 判断是否是带内容哈希的构建产物。
// rsbuild 输出在 /static/{js,css,font,image,media}/ 下，文件名含 8~10 位 hash。
func isHashedAsset(path string) bool {
	return strings.HasPrefix(path, "/static/")
}
