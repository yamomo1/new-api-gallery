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

package controller

import (
	"encoding/json"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service/seo"
	"github.com/gin-gonic/gin"
)

// GetSeoConfig 返回当前生效的 SEO 配置（公开）。
// 前端 useSeo 用它做 SPA 内部跳转时的标题/描述同步，保证与首屏服务端注入一致。
func GetSeoConfig(c *gin.Context) {
	c.Header("Cache-Control", "no-cache")
	c.JSON(http.StatusOK, gin.H{"success": true, "data": seo.LoadConfig()})
}

// UpdateSeoConfig 保存 SEO 配置（仅超管，路径 /api/seo/config）。
// 请求体就是完整的 SeoConfig JSON；服务端先校验能解析，再落 Option。
func UpdateSeoConfig(c *gin.Context) {
	body, err := io.ReadAll(io.LimitReader(c.Request.Body, 256*1024))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "读取请求体失败"})
		return
	}
	trimmed := strings.TrimSpace(string(body))
	if trimmed == "" || trimmed == "null" {
		trimmed = "{}"
	}
	var probe seo.Config
	if err := json.Unmarshal([]byte(trimmed), &probe); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "SEO 配置不是合法 JSON：" + err.Error()})
		return
	}
	if probe.BaseURL != "" && !strings.HasPrefix(probe.BaseURL, "http") {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "站点地址必须以 http(s):// 开头"})
		return
	}
	if err := model.UpdateOption(seo.OptionKey, trimmed); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}
	// 配置是带缓存的，保存后立刻失效，避免要等一次进程重启
	seo.ResetCache()
	c.JSON(http.StatusOK, gin.H{"success": true, "data": seo.LoadConfig()})
}

// GetRobotsTxt 输出 robots.txt（由配置生成，不要手改 dist 里的文件）。
func GetRobotsTxt(c *gin.Context) {
	c.Header("Cache-Control", "public, max-age=600")
	c.Data(http.StatusOK, "text/plain; charset=utf-8", []byte(seo.RobotsTxt()))
}

// GetSitemapXML 输出 sitemap.xml。
func GetSitemapXML(c *gin.Context) {
	c.Header("Cache-Control", "public, max-age=600")
	c.Data(http.StatusOK, "application/xml; charset=utf-8", []byte(seo.SitemapXML()))
}

// GetLLMsTxt 输出 llms.txt（给大模型的站点说明书）。
func GetLLMsTxt(c *gin.Context) {
	c.Header("Cache-Control", "public, max-age=600")
	c.Data(http.StatusOK, "text/plain; charset=utf-8", []byte(seo.LLMsTxt()))
}
