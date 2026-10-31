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
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/model"
)

// Injection 是注入结果：HTML + 建议的 HTTP 状态码。
// 详情页 URL 合法但记录不存在/未发布时返回 404，让搜索引擎正确地下架。
type Injection struct {
	HTML   []byte
	Status int
}

// InjectIndex 把当前路径对应的 SEO 标签写进 index.html。
//
// 纯字符串替换（不重排 HTML）：index.html 只有几 KB，每次请求重算的开销
// 远小于引入模板引擎的复杂度；真正贵的是反序列化配置，而它已按内容做了缓存。
func InjectIndex(index []byte, urlPath string) Injection {
	cfg := LoadConfig()
	detail := ResolveDetail(urlPath)

	title := cfg.TitleFor(urlPath)
	if detail != nil {
		title = cfg.detailTitle(detail)
	}

	out := replaceTitle(index, title)
	out = injectHead(out, cfg.headTags(urlPath, detail))
	// 详情页额外塞一段 <noscript>：不执行 JS 的大模型爬虫
	// （GPTBot / ClaudeBot / PerplexityBot）只能靠它读到提示词正文。
	// 这是合法可见内容，不是隐藏文本，不存在 cloaking 风险。
	if detail != nil && !detail.NotFound {
		out = injectNoscript(out, detail)
	}

	status := http.StatusOK
	if detail != nil && detail.NotFound {
		status = http.StatusNotFound
	}
	return Injection{HTML: out, Status: status}
}

// injectHead 在 </head> 前插入片段；找不到就追加到末尾兜底。
func injectHead(doc []byte, head string) []byte {
	if i := bytes.Index(doc, []byte("</head>")); i >= 0 {
		merged := make([]byte, 0, len(doc)+len(head))
		merged = append(merged, doc[:i]...)
		merged = append(merged, head...)
		merged = append(merged, doc[i:]...)
		return merged
	}
	return append(doc, head...)
}

// injectNoscript 在 </body> 前插入正文摘要（详见 InjectIndex 的说明）。
func injectNoscript(doc []byte, detail *DetailMeta) []byte {
	var b strings.Builder
	b.WriteString("    <noscript>\n")
	b.WriteString("      <article>\n")
	b.WriteString("        <h1>" + html.EscapeString(detail.Title) + "</h1>\n")
	if detail.Author != "" {
		b.WriteString("        <p>作者：" + html.EscapeString(detail.Author) + "</p>\n")
	}
	if detail.Model != "" || detail.Category != "" {
		b.WriteString("        <p>模型：" + html.EscapeString(detail.Model) +
			"　分类：" + html.EscapeString(detail.Category) + "　类型：" +
			html.EscapeString(detailTypeLabel(detail)) + "</p>\n")
	}
	b.WriteString("        <h2>提示词</h2>\n")
	b.WriteString("        <p>" + html.EscapeString(detail.Description) + "</p>\n")
	if len(detail.Tags) > 0 {
		b.WriteString("        <p>标签：" + html.EscapeString(strings.Join(detail.Tags, "、")) + "</p>\n")
	}
	b.WriteString("        <p><a href=\"/prompt-gallery\">一幕AI 提示词画廊</a></p>\n")
	b.WriteString("      </article>\n")
	b.WriteString("    </noscript>\n")

	if i := bytes.LastIndex(doc, []byte("</body>")); i >= 0 {
		merged := make([]byte, 0, len(doc)+b.Len())
		merged = append(merged, doc[:i]...)
		merged = append(merged, b.String()...)
		merged = append(merged, doc[i:]...)
		return merged
	}
	return append(doc, b.String()...)
}

func detailTypeLabel(d *DetailMeta) string {
	if d.Type == "video" {
		return "AI 视频"
	}
	return "AI 图片"
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

// headData 是一次注入最终要用的那几项，详情页与静态页共用同一条写入路径。
type headData struct {
	title       string
	description string
	keywords    string
	robots      string
	canonical   string
	ogImage     string
	ogType      string
	detail      *DetailMeta
}

// headData 计算某个路径的最终 head 数据；detail 非空时整组以单条记录为准。
func (c *Config) headDataFor(urlPath string, detail *DetailMeta) headData {
	if detail == nil {
		ogType := "website"
		if urlPath == "/prompt-gallery" {
			ogType = "article"
		}
		return headData{
			title:       c.TitleFor(urlPath),
			description: c.DescriptionFor(urlPath),
			keywords:    c.KeywordsFor(urlPath),
			robots:      c.RobotsFor(urlPath),
			canonical:   c.Canonical(urlPath),
			ogImage:     c.absoluteImage(c.OGImage),
			ogType:      ogType,
		}
	}

	canonical := c.BaseURL + DetailPathPrefix + strconv.FormatInt(detail.ID, 10)
	d := headData{
		title:       c.detailTitle(detail),
		description: detail.Description,
		keywords:    detail.Keywords,
		robots:      "index,follow",
		canonical:   canonical,
		ogImage:     detail.Image,
		ogType:      "article",
		detail:      detail,
	}
	if detail.NotFound {
		d.robots = "noindex,follow"
		d.description = "这条提示词不存在或已下架，去提示词画廊看看其它作品。"
		d.keywords = ""
	}
	if d.ogImage == "" {
		d.ogImage = c.absoluteImage(c.OGImage)
	}
	return d
}

// detailTitle 单条页标题：作品名 + 类型关键词，再套全站模板。
func (c *Config) detailTitle(d *DetailMeta) string {
	if d.NotFound {
		return "提示词不存在 · " + c.SiteName
	}
	page := d.Title
	if page == "" {
		page = "AI 提示词"
	}
	if d.Type == "video" {
		page += " · AI 视频提示词"
	} else {
		page += " · AI 绘画提示词"
	}
	if c.TitleTemplate == "" {
		return page
	}
	out := strings.ReplaceAll(c.TitleTemplate, "{page}", page)
	return strings.ReplaceAll(out, "{site}", c.SiteName)
}

func (c *Config) absoluteImage(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" || strings.HasPrefix(raw, "http") {
		return raw
	}
	return c.BaseURL + "/" + strings.TrimPrefix(raw, "/")
}

func (c *Config) headTags(urlPath string, detail *DetailMeta) string {
	var b strings.Builder
	d := c.headDataFor(urlPath, detail)
	title, desc, canonical, ogImage, ogType := d.title, d.description, d.canonical, d.ogImage, d.ogType

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
	writeMeta("name", "keywords", d.keywords)
	writeMeta("name", "robots", d.robots)
	writeMeta("name", "author", c.SiteName)
	writeMeta("name", "google-site-verification", c.Verification.Google)
	writeMeta("name", "baidu-site-verification", c.Verification.Baidu)
	writeMeta("name", "msvalidate.01", c.Verification.Bing)
	fmt.Fprintf(&b, "    <link rel=\"canonical\" href=\"%s\" />\n", html.EscapeString(canonical))

	// Open Graph
	writeProp("og:type", ogType)
	writeProp("og:site_name", c.SiteName)
	writeProp("og:title", title)
	writeProp("og:description", desc)
	writeProp("og:url", canonical)
	writeProp("og:image", ogImage)
	writeProp("og:locale", c.Locale)
	if detail != nil && detail.PublishedAt > 0 {
		writeProp("article:published_time", isoTime(detail.PublishedAt))
	}
	if detail != nil && detail.UpdatedAt > 0 {
		writeProp("article:modified_time", isoTime(detail.UpdatedAt))
	}

	// Twitter / X
	writeMeta("name", "twitter:card", "summary_large_image")
	writeMeta("name", "twitter:site", c.Twitter)
	writeMeta("name", "twitter:title", title)
	writeMeta("name", "twitter:description", desc)
	writeMeta("name", "twitter:image", ogImage)

	// 结构化数据：让搜索引擎与大模型直接吃到「谁、是什么、有哪些页」
	for _, payload := range c.structuredData(urlPath, d) {
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

func (c *Config) structuredData(urlPath string, d headData) []map[string]any {
	orgID := c.BaseURL + "/#organization"
	siteID := c.BaseURL + "/#website"
	title, desc, canonical := d.title, d.description, d.canonical

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
		"@context":      "https://schema.org",
		"@type":         "WebSite",
		"@id":           siteID,
		"name":          c.SiteName,
		"alternateName": c.Brand,
		"url":           c.BaseURL,
		"inLanguage":    c.Locale,
		"publisher":     map[string]any{"@id": orgID},
	}

	pageType := "WebPage"
	if urlPath == "/prompt-gallery" {
		pageType = "CollectionPage"
	}
	if d.detail != nil {
		pageType = "ItemPage"
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
	if d.detail != nil && d.detail.Image != "" {
		page["primaryImageOfPage"] = map[string]any{
			"@type": "ImageObject",
			"url":   d.detail.Image,
		}
	}

	data := []map[string]any{org, site, page}
	if urlPath == "/" {
		data = append(data, map[string]any{
			"@context":            "https://schema.org",
			"@type":               "WebApplication",
			"name":                c.SiteName,
			"url":                 c.BaseURL,
			"applicationCategory": "DesignApplication",
			"operatingSystem":     "Web",
			"description":         c.Description,
			"offers": map[string]any{
				"@type":         "Offer",
				"price":         "0",
				"priceCurrency": "CNY",
			},
		})
	}
	if d.detail != nil && !d.detail.NotFound {
		data = append(data, c.detailStructuredData(d)...)
	}
	return data
}

// detailStructuredData 给单条提示词加 CreativeWork + 面包屑，
// 这是让 AI 搜索把「某条提示词」当成独立实体引用的关键。
func (c *Config) detailStructuredData(d headData) []map[string]any {
	item := d.detail
	creativeType := "ImageObject"
	if item.Type == "video" {
		creativeType = "VideoObject"
	}
	work := map[string]any{
		"@context":    "https://schema.org",
		"@type":       creativeType,
		"@id":         d.canonical + "#creativework",
		"name":        item.Title,
		"description": item.Description,
		"inLanguage":  c.Locale,
		"isPartOf":    map[string]any{"@id": c.BaseURL + "/#website"},
		"creator":     map[string]any{"@type": "Organization", "name": c.SiteName},
	}
	if item.Image != "" {
		work["contentUrl"] = item.Image
		work["thumbnailUrl"] = item.Image
		work["image"] = item.Image
	}
	if item.Author != "" {
		work["author"] = map[string]any{"@type": "Person", "name": item.Author}
	}
	if len(item.Tags) > 0 {
		work["keywords"] = strings.Join(item.Tags, ",")
	}
	if item.Category != "" {
		work["genre"] = item.Category
	}
	if item.Model != "" {
		work["about"] = map[string]any{"@type": "SoftwareApplication", "name": item.Model}
	}
	if v := isoTime(item.PublishedAt); v != "" {
		work["datePublished"] = v
	}
	if v := isoTime(item.UpdatedAt); v != "" {
		work["dateModified"] = v
	}

	breadcrumb := map[string]any{
		"@context": "https://schema.org",
		"@type":    "BreadcrumbList",
		"itemListElement": []map[string]any{
			{"@type": "ListItem", "position": 1, "name": "首页", "item": c.BaseURL + "/"},
			{"@type": "ListItem", "position": 2, "name": "提示词画廊", "item": c.BaseURL + "/prompt-gallery"},
			{"@type": "ListItem", "position": 3, "name": item.Title, "item": d.canonical},
		},
	}
	return []map[string]any{work, breadcrumb}
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

// sitemapEntry 是 <url> 的一条记录。
type sitemapEntry struct {
	loc        string
	lastmod    string
	changeFreq string
	priority   float64
}

// SitemapXML 生成站点地图：只收进 sitemap 的页面（noindex 自动排除）。
func SitemapXML() string {
	cfg := LoadConfig()
	today := time.Now().Format("2006-01-02")

	entries := make([]sitemapEntry, 0, len(cfg.Pages))
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
		entries = append(entries, sitemapEntry{
			loc:        cfg.Canonical(path),
			lastmod:    today,
			changeFreq: meta.ChangeFreq,
			priority:   meta.Priority,
		})
	}
	// 详情页逐条收录：这才是长尾流量的入口 —— 静态页只有个位数 URL，
	// 单条提示词才是真正匹配用户搜索原话的页面。
	entries = append(entries, cfg.detailEntries()...)

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
		if e.lastmod != "" {
			b.WriteString("    <lastmod>" + e.lastmod + "</lastmod>\n")
		}
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

// sitemapDetailLimit 单份 sitemap 收录的详情页上限。
// 协议上限是单文件 5 万条 / 50MB，这里留足余量；超出后需要拆 sitemap index。
const sitemapDetailLimit = 5000

// detailEntries 把已发布提示词逐条转成 sitemap 条目。
// 画廊被关掉索引（noindex / 不进 sitemap）时整组跳过 —— 子页面不能比父页面更开放。
func (c *Config) detailEntries() []sitemapEntry {
	meta, ok := c.Pages["/prompt-gallery"]
	if !ok {
		return nil
	}
	if meta.InSitemap != nil && !*meta.InSitemap {
		return nil
	}
	if strings.Contains(c.RobotsFor("/prompt-gallery"), "noindex") {
		return nil
	}
	items, err := model.ListPromptGallerySitemap(sitemapDetailLimit)
	if err != nil || len(items) == 0 {
		return nil
	}
	out := make([]sitemapEntry, 0, len(items))
	for _, it := range items {
		lastmod := todayOf(it.UpdatedAt)
		out = append(out, sitemapEntry{
			loc:        c.BaseURL + DetailPathPrefix + strconv.FormatInt(it.Id, 10),
			lastmod:    lastmod,
			changeFreq: "monthly",
			priority:   0.6,
		})
	}
	return out
}

func todayOf(ts int64) string {
	if ts <= 0 {
		return ""
	}
	return time.Unix(ts, 0).Format("2006-01-02")
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
	b.WriteString("- 中文 AI 创作平台，核心是「提示词画廊 + 无限画布」。\n")
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
