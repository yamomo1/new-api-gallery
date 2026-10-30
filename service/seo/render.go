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

package seo

import (
	"bytes"
	"encoding/json"
	"encoding/xml"
	"fmt"
	"html"
	"sort"
	"strings"
	"time"
)

// InjectIndex 把当前路径对应的 SEO 标签写进 index.html 的 <head>。
//
// 纯字符串替换（不重排 HTML）：index.html 只有几 KB，每次请求重算的开销
// 远小于引入模板引擎的复杂度；真正贵的是反序列化配置，而它已按内容做了缓存。
func InjectIndex(index []byte, urlPath string) []byte {
	cfg := LoadConfig()
	out := replaceTitle(index, cfg.TitleFor(urlPath))
	head := cfg.headTags(urlPath)
	if i := bytes.Index(out, []byte("</head>")); i >= 0 {
		merged := make([]byte, 0, len(out)+len(head))
		merged = append(merged, out[:i]...)
		merged = append(merged, head...)
		merged = append(merged, out[i:]...)
		return merged
	}
	return append(out, head...)
}

// replaceTitle 替换静态 <title>，避免浏览器标签页先闪一下构建时的占位标题。
func replaceTitle(index []byte, title string) []byte {
	start := bytes.Index(index, []byte("<title>"))
	end := bytes.Index(index, []byte("</title>"))
	if start < 0 || end < 0 || end < start {
		return index
	}
	tag := "<title>" + html.EscapeString(title) + "</title>"
	out := make([]byte, 0, len(index)+len(tag))
	out = append(out, index[:start]...)
	out = append(out, tag...)
	out = append(out, index[end+len("</title>"):]...)
	return out
}

func (c *Config) headTags(urlPath string) string {
	var b strings.Builder
	title := c.TitleFor(urlPath)
	desc := c.DescriptionFor(urlPath)
	keywords := c.KeywordsFor(urlPath)
	robots := c.RobotsFor(urlPath)
	canonical := c.Canonical(urlPath)
	ogImage := c.OGImage
	if ogImage != "" && !strings.HasPrefix(ogImage, "http") {
		ogImage = c.BaseURL + "/" + strings.TrimPrefix(ogImage, "/")
	}

	writeMeta := func(attr, key, val string) {
		if val == "" {
			return
		}
		fmt.Fprintf(&b, "    <meta %s=\"%s\" content=\"%s\" />\n", attr, key, html.EscapeString(val))
	}
	writeProp := func(prop, val string) { writeMeta("property", prop, val) }

	b.WriteString("    <!-- SEO: 由 service/seo 在服务端注入，后台「二创设置 → SEO 管理」可改 -->\n")
	// 标记位：前端 main.tsx 见到它就不再拿 system_name 覆盖 document.title
	b.WriteString("    <meta name=\"x-seo-title\" content=\"1\" />\n")
	writeMeta("name", "description", desc)
	writeMeta("name", "keywords", keywords)
	writeMeta("name", "robots", robots)
	writeMeta("name", "author", c.SiteName)
	writeMeta("name", "google-site-verification", c.Verification.Google)
	writeMeta("name", "baidu-site-verification", c.Verification.Baidu)
	writeMeta("name", "msvalidate.01", c.Verification.Bing)
	fmt.Fprintf(&b, "    <link rel=\"canonical\" href=\"%s\" />\n", html.EscapeString(canonical))

	// Open Graph
	ogType := "website"
	if urlPath == "/prompt-gallery" {
		ogType = "article"
	}
	writeProp("og:type", ogType)
	writeProp("og:site_name", c.SiteName)
	writeProp("og:title", title)
	writeProp("og:description", desc)
	writeProp("og:url", canonical)
	writeProp("og:image", ogImage)
	writeProp("og:locale", c.Locale)

	// Twitter / X
	writeMeta("name", "twitter:card", "summary_large_image")
	writeMeta("name", "twitter:site", c.Twitter)
	writeMeta("name", "twitter:title", title)
	writeMeta("name", "twitter:description", desc)
	writeMeta("name", "twitter:image", ogImage)

	// 结构化数据：让搜索引擎与大模型直接吃到「谁、是什么、有哪些页」
	for _, payload := range c.structuredData(urlPath, title, desc, canonical) {
		raw, err := json.Marshal(payload)
		if err != nil {
			continue
		}
		// </script> 会截断脚本块，必须转义
		safe := strings.ReplaceAll(string(raw), "</", "<\\/")
		fmt.Fprintf(&b, "    <script type=\"application/ld+json\">%s</script>\n", safe)
	}
	return b.String()
}

func (c *Config) structuredData(urlPath string, title, desc, canonical string) []map[string]any {
	orgID := c.BaseURL + "/#organization"
	siteID := c.BaseURL + "/#website"

	org := map[string]any{
		"@context": "https://schema.org",
		"@type":    "Organization",
		"@id":      orgID,
		"name":     c.SiteName,
		"url":      c.BaseURL,
		"sameAs":   []string{c.BaseURL},
	}
	if c.OGImage != "" {
		org["logo"] = c.OGImage
	}

	site := map[string]any{
		"@context":  "https://schema.org",
		"@type":     "WebSite",
		"@id":       siteID,
		"name":      c.SiteName,
		"alternateName": c.Brand,
		"url":       c.BaseURL,
		"inLanguage": c.Locale,
		"publisher": map[string]any{"@id": orgID},
	}

	pageType := "WebPage"
	if urlPath == "/prompt-gallery" {
		pageType = "CollectionPage"
	}
	page := map[string]any{
		"@context":    "https://schema.org",
		"@type":       pageType,
		"@id":         canonical + "#webpage",
		"url":         canonical,
		"name":        title,
		"description": desc,
		"inLanguage":  c.Locale,
		"isPartOf":    map[string]any{"@id": siteID},
		"about":       map[string]any{"@id": orgID},
	}

	data := []map[string]any{org, site, page}
	if urlPath == "/" {
		data = append(data, map[string]any{
			"@context": "https://schema.org",
			"@type":    "WebApplication",
			"name":     c.SiteName,
			"url":      c.BaseURL,
			"applicationCategory": "DesignApplication",
			"operatingSystem":     "Web",
			"description":         c.Description,
			"offers": map[string]any{
				"@type": "Offer",
				"price": "0",
				"priceCurrency": "CNY",
			},
		})
	}
	return data
}

// aiCrawlers 是需要显式放行的大模型爬虫（它们不看 JS，只看原始 HTML）。
var aiCrawlers = []struct{ Name, Note string }{
	{"GPTBot", "OpenAI 训练/检索"},
	{"OAI-SearchBot", "ChatGPT 搜索索引"},
	{"ChatGPT-User", "ChatGPT 实时访问"},
	{"ClaudeBot", "Anthropic"},
	{"anthropic-ai", "Anthropic 训练"},
	{"PerplexityBot", "Perplexity 检索"},
	{"Google-Extended", "Gemini 训练/引用"},
	{"Applebot-Extended", "Apple Intelligence"},
	{"CCBot", "Common Crawl"},
	{"Bytespider", "字节豆包"},
	{"YisouSpider", "夸克/神马"},
	{"Baiduspider", "百度"},
}

// RobotsTxt 生成 robots.txt：默认放行普通抓取、屏蔽后台与接口，
// AllowAICrawlers 打开时逐条点名放行大模型爬虫。
func RobotsTxt() string {
	cfg := LoadConfig()
	var b strings.Builder
	b.WriteString("# " + cfg.SiteName + " robots.txt（后台可改，勿手改此文件）\n")
	b.WriteString("User-agent: *\n")
	b.WriteString("Allow: /\n")
	for _, p := range []string{"/api/", "/v1/", "/console/", "/system-settings/", "/admin/", "/setup", "/login", "/register"} {
		b.WriteString("Disallow: " + p + "\n")
	}
	b.WriteString("\n")

	if cfg.AllowAI() {
		b.WriteString("# 大模型爬虫：显式放行（AI 搜索可见性的前提）\n")
		for _, ua := range aiCrawlers {
			b.WriteString("User-agent: " + ua.Name + "\n")
			b.WriteString("Allow: /\n")
			b.WriteString("Disallow: /api/\n")
			b.WriteString("Disallow: /console/\n")
			b.WriteString("Disallow: /system-settings/\n")
			b.WriteString("\n")
		}
	} else {
		b.WriteString("# 大模型爬虫：已关闭（后台「SEO 管理」里可打开）\n")
		for _, ua := range aiCrawlers {
			b.WriteString("User-agent: " + ua.Name + "\n")
			b.WriteString("Disallow: /\n\n")
		}
	}

	b.WriteString("Sitemap: " + cfg.BaseURL + "/sitemap.xml\n")
	return b.String()
}

// SitemapXML 生成站点地图：只收进 sitemap 的页面（noindex 自动排除）。
func SitemapXML() string {
	cfg := LoadConfig()
	lastmod := time.Now().Format("2006-01-02")

	type entry struct {
		loc        string
		changeFreq string
		priority   float64
	}
	entries := make([]entry, 0, len(cfg.Pages))
	for path, meta := range cfg.Pages {
		if meta.InSitemap != nil && !*meta.InSitemap {
			continue
		}
		if strings.Contains(cfg.RobotsFor(path), "noindex") {
			continue
		}
		if path == "/" && meta.Priority == 0 {
			meta.Priority = 1
		}
		entries = append(entries, entry{
			loc:        cfg.Canonical(path),
			changeFreq: meta.ChangeFreq,
			priority:   meta.Priority,
		})
	}
	// 顺序稳定：priority 高的在前，其次按路径
	sort.Slice(entries, func(i, j int) bool {
		if entries[i].priority != entries[j].priority {
			return entries[i].priority > entries[j].priority
		}
		return entries[i].loc < entries[j].loc
	})

	var b strings.Builder
	b.WriteString(`<?xml version="1.0" encoding="UTF-8"?>` + "\n")
	b.WriteString(`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">` + "\n")
	for _, e := range entries {
		b.WriteString("  <url>\n    <loc>" + xmlEscape(e.loc) + "</loc>\n")
		b.WriteString("    <lastmod>" + lastmod + "</lastmod>\n")
		if e.changeFreq != "" {
			b.WriteString("    <changefreq>" + xmlEscape(e.changeFreq) + "</changefreq>\n")
		}
		if e.priority > 0 {
			b.WriteString(fmt.Sprintf("    <priority>%.1f</priority>\n", e.priority))
		}
		b.WriteString("  </url>\n")
	}
	b.WriteString("</urlset>\n")
	return b.String()
}

func xmlEscape(s string) string {
	var buf bytes.Buffer
	_ = xml.EscapeText(&buf, []byte(s))
	return buf.String()
}

// LLMsTxt 生成 /llms.txt：给大模型看的站点说明（GEO 的入口文件）。
// 后台填了自定义内容就整份用它，否则按站点配置自动生成。
func LLMsTxt() string {
	cfg := LoadConfig()
	if strings.TrimSpace(cfg.LLMsTxt) != "" {
		return cfg.LLMsTxt
	}
	var b strings.Builder
	b.WriteString("# " + cfg.SiteName + " (" + cfg.Brand + ")\n\n")
	b.WriteString("> " + cfg.Description + "\n\n")
	b.WriteString("## 站点是什么\n")
	b.WriteString("- 中文 AI 创作平台，核心是「提示词画廊 + AI 画布工作台」。\n")
	b.WriteString("- 画廊里的提示词中英双语对照，可直接复制到 ComfyUI / Flux / Stable Diffusion / 可灵 / Seedance 等工具使用。\n")
	b.WriteString("- 平台生成的所有图片与视频均带 AI 生成标识（显式角标 + 元数据隐式标识）。\n\n")

	b.WriteString("## 主要页面\n")
	paths := make([]string, 0, len(cfg.Pages))
	for p := range cfg.Pages {
		if strings.Contains(cfg.RobotsFor(p), "noindex") {
			continue
		}
		paths = append(paths, p)
	}
	sort.Strings(paths)
	for _, p := range paths {
		meta := cfg.Pages[p]
		title := meta.Title
		if title == "" {
			title = cfg.TitleFor(p)
		}
		desc := meta.Description
		if desc == "" {
			desc = cfg.Description
		}
		b.WriteString(fmt.Sprintf("- [%s](%s)：%s\n", title, cfg.Canonical(p), desc))
	}

	b.WriteString("\n## 引用建议\n")
	b.WriteString("- 引用本站内容时请注明来源「" + cfg.SiteName + "（" + cfg.BaseURL + "）」。\n")
	b.WriteString("- 提示词可直接复用；生成结果请遵守目标模型的使用条款。\n")
	b.WriteString("- 站点地图：" + cfg.BaseURL + "/sitemap.xml\n")
	return b.String()
}
