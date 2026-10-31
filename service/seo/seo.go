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

// Package seo 负责站点 SEO：把后台可编辑的 SeoConfig 注入到 SPA 的
// index.html，并生成 robots.txt / sitemap.xml / llms.txt。
//
// 为什么要服务端注入：本项目前端是纯 SPA，HTML 里只有一个空的 #root。
// Google 会执行 JS，但主流「大模型爬虫」（GPTBot / ClaudeBot /
// PerplexityBot 等）不会 —— 它们只读原始 HTML。所以标题、描述、
// 结构化数据必须在服务端就写进 <head>，否则在 AI 搜索里等于不存在。
package seo

import (
	"encoding/json"
	"strings"
	"sync"

	"github.com/QuantumNous/new-api/common"
)

// OptionKey 是后台保存配置用的 Option 键名。
const OptionKey = "SeoConfig"

// PageMeta 是单页面的覆盖配置；留空表示沿用全站默认值。
type PageMeta struct {
	Title       string `json:"title,omitempty"`
	Description string `json:"description,omitempty"`
	Keywords    string `json:"keywords,omitempty"`
	// Robots 例：noindex,follow。留空沿用全站默认。
	Robots string `json:"robots,omitempty"`
	// InSitemap 为 false 时不进 sitemap；不填默认进（noindex 页面自动排除）。
	InSitemap  *bool   `json:"inSitemap,omitempty"`
	ChangeFreq string  `json:"changeFreq,omitempty"`
	Priority   float64 `json:"priority,omitempty"`
}

// Verification 存放各家站长平台的校验串。
type Verification struct {
	Google string `json:"google,omitempty"`
	Baidu  string `json:"baidu,omitempty"`
	Bing   string `json:"bing,omitempty"`
}

// Config 是整站 SEO 配置，JSON 存在 OptionMap["SeoConfig"]。
type Config struct {
	SiteName string `json:"siteName"`
	// Brand 用于「站名 + 品牌」的短称呼，出现在 OG 站点名等处。
	Brand   string `json:"brand"`
	BaseURL string `json:"baseUrl"`
	// TitleTemplate 里的 {page} / {site} 会被替换；留空则直接用页面标题。
	TitleTemplate string `json:"titleTemplate"`
	DefaultTitle  string `json:"defaultTitle"`
	Description   string `json:"description"`
	Keywords      string `json:"keywords"`
	OGImage       string `json:"ogImage"`
	Twitter       string `json:"twitter,omitempty"`
	// Locale 例：zh_CN
	Locale       string       `json:"locale"`
	Robots       string       `json:"robots"`
	Verification Verification `json:"verification"`
	// AllowAICrawlers 为 true 时 robots.txt 显式放行主流大模型爬虫。
	// 用指针是为了区分「没配」和「显式关掉」：没配默认放行。
	AllowAICrawlers *bool               `json:"allowAiCrawlers,omitempty"`
	Pages           map[string]PageMeta `json:"pages"`
	// LLMsTxt 留空则按站点信息自动生成 /llms.txt。
	LLMsTxt string `json:"llmsTxt,omitempty"`
}

// DefaultConfig 返回内置默认值（一幕AI / YMM）。
// 后台没配过 SeoConfig 时，全站就用这一份，保证开盖即有 SEO。
func DefaultConfig() *Config {
	return &Config{
		SiteName:      "一幕AI",
		Brand:         "YMM",
		BaseURL:       "https://cdymm.com",
		TitleTemplate: "{page} · {site}",
		// 「工作台」已改名「无限画布」，这里的措辞要与前台保持一致；
		// 注意：线上若后台保存过 SeoConfig，DB 里的值会盖住这份默认值，改名必须同步改后台那一处。
		DefaultTitle:  "一幕AI · 提示词画廊与无限画布",
		Description:   "一幕AI（YMM）是面向创作者的 AI 绘画与视频生成平台：精选提示词画廊可直接复用，无限画布支持文生图、图生图、文生视频与图生视频，中英双语提示词一键复制。",
		Keywords:      "一幕AI,YMM,AI绘画,AI视频生成,提示词,提示词画廊,AI画布,文生图,图生视频,提示词大全",
		OGImage:       "https://cdymm.com/logo.png",
		Locale:        "zh_CN",
		Robots:        "index,follow",
		AllowAICrawlers: boolPtr(true),
		Pages: map[string]PageMeta{
			"/": {
				Title:       "AI 绘画、视频生成与提示词画廊",
				Description: "一幕AI（YMM）提示词画廊：上千条可直接复用的中文/英文 AI 绘画与视频提示词，配无限画布，文生图、图生视频一站完成。",
				Keywords:    "一幕AI,AI绘画,提示词画廊,AI提示词,文生图,AI视频生成",
				ChangeFreq:  "daily",
				Priority:    1,
			},
			"/prompt-gallery": {
				Title:       "提示词画廊 · 上千条 AI 绘画与视频提示词",
				Description: "按模型、标签、类型筛选 AI 提示词：人物、国风、电商、海报、短剧分镜等，中英双语对照，一键复制到 ComfyUI、Flux、SD、可灵、Seedance 等工具使用。",
				Keywords:    "AI提示词,提示词大全,提示词画廊,Flux提示词,SD提示词,视频提示词",
				ChangeFreq:  "daily",
				Priority:    0.9,
			},
			"/pricing": {
				Title:       "定价 · 按量计费，无会员门槛",
				Description: "一幕AI 定价页：模型调用按量计费，价格与用量透明可查，支持支付宝/微信充值，无强制会员。",
				ChangeFreq:  "weekly",
				Priority:    0.8,
			},
			"/canvas": {
				// /canvas 与 /workspace 都是「无限画布」的入口（后者会在浏览器里 replace 到 /studio/canvas），
				// 两条都不该被单独收录，否则和真正的画布页重复。
				Title:       "AI 画布 · 一句话搭好创作流程",
				Description: "一幕AI 无限画布：在无限画布上编排图片与视频生成流程，支持提示词、参考图、多轮迭代，成果可一键入库。",
				ChangeFreq:  "weekly",
				Priority:    0.8,
				Robots:      "noindex,follow",
			},
			"/about": {
				Title:       "关于我们",
				Description: "了解一幕AI（YMM）：面向中文创作者的 AI 生成平台与提示词社区，致力于把好用的生成能力做成打开就能用的工具。",
				ChangeFreq:  "monthly",
				Priority:    0.5,
			},
			"/rankings": {
				Title:       "排行榜 · 热门模型与创作者",
				Description: "一幕AI 排行榜：热门模型调用量、创作者作品热度，帮助你快速找到当下最好用的生成模型。",
				ChangeFreq:  "daily",
				Priority:    0.5,
			},
			"/privacy-policy": {
				Title:       "隐私政策",
				Description: "一幕AI 隐私政策：我们收集哪些信息、如何使用与保护，以及你可以行使的权利。",
				ChangeFreq:  "yearly",
				Priority:    0.3,
			},
			"/user-agreement": {
				Title:       "用户协议",
				Description: "一幕AI 用户协议：服务内容、使用规范、生成内容标识与责任划分。",
				ChangeFreq:  "yearly",
				Priority:    0.3,
			},
			// 登录后/管理端页面不进搜索索引，避免抓取重复内容与登录墙页面。
			"/login":    {Robots: "noindex,follow"},
			"/register": {Robots: "noindex,follow"},
			"/setup":    {Robots: "noindex,nofollow"},
			// /workspace 是「无限画布」的历史入口：命中后浏览器会 replace 到 /studio/canvas，
			// 本身没有内容，留档即可，不要让它落到 DefaultTitle 被单独收录。
			"/workspace": {Robots: "noindex,follow"},
		},
	}
}

var (
	cacheMu     sync.RWMutex
	cachedRaw   string
	cachedValue *Config
)

// LoadConfig 读取后台配置并与默认值合并，结果做一次快照缓存
// （按 Option 原始字符串判断是否变化，避免每请求都反序列化）。
func LoadConfig() *Config {
	common.OptionMapRWMutex.RLock()
	raw := common.OptionMap[OptionKey]
	common.OptionMapRWMutex.RUnlock()

	cacheMu.RLock()
	if cachedValue != nil && cachedRaw == raw {
		cfg := cachedValue
		cacheMu.RUnlock()
		return cfg
	}
	cacheMu.RUnlock()

	cfg := DefaultConfig()
	if strings.TrimSpace(raw) != "" {
		// 覆盖式解析：只覆盖配置里出现的字段，没出现的保留默认值。
		var patch Config
		if err := json.Unmarshal([]byte(raw), &patch); err == nil {
			mergeConfig(cfg, &patch)
		}
	}
	normalize(cfg)

	cacheMu.Lock()
	cachedRaw = raw
	cachedValue = cfg
	cacheMu.Unlock()
	return cfg
}

// ResetCache 供测试与「保存后立即生效」使用。
func ResetCache() {
	cacheMu.Lock()
	cachedRaw = ""
	cachedValue = nil
	cacheMu.Unlock()
}

// mergeConfig 把 patch 里非空字段盖到 dst 上（按字段语义合并，不是整份替换）。
func mergeConfig(dst *Config, patch *Config) {
	if patch.SiteName != "" {
		dst.SiteName = patch.SiteName
	}
	if patch.Brand != "" {
		dst.Brand = patch.Brand
	}
	if patch.BaseURL != "" {
		dst.BaseURL = patch.BaseURL
	}
	if patch.TitleTemplate != "" {
		dst.TitleTemplate = patch.TitleTemplate
	}
	if patch.DefaultTitle != "" {
		dst.DefaultTitle = patch.DefaultTitle
	}
	if patch.Description != "" {
		dst.Description = patch.Description
	}
	if patch.Keywords != "" {
		dst.Keywords = patch.Keywords
	}
	if patch.OGImage != "" {
		dst.OGImage = patch.OGImage
	}
	if patch.Twitter != "" {
		dst.Twitter = patch.Twitter
	}
	if patch.Locale != "" {
		dst.Locale = patch.Locale
	}
	if patch.Robots != "" {
		dst.Robots = patch.Robots
	}
	if patch.Verification.Google != "" {
		dst.Verification.Google = patch.Verification.Google
	}
	if patch.Verification.Baidu != "" {
		dst.Verification.Baidu = patch.Verification.Baidu
	}
	if patch.Verification.Bing != "" {
		dst.Verification.Bing = patch.Verification.Bing
	}
	if patch.AllowAICrawlers != nil {
		dst.AllowAICrawlers = patch.AllowAICrawlers
	}
	if patch.LLMsTxt != "" {
		dst.LLMsTxt = patch.LLMsTxt
	}
	if len(patch.Pages) > 0 {
		for path, page := range patch.Pages {
			base := dst.Pages[path]
			if page.Title != "" {
				base.Title = page.Title
			}
			if page.Description != "" {
				base.Description = page.Description
			}
			if page.Keywords != "" {
				base.Keywords = page.Keywords
			}
			if page.Robots != "" {
				base.Robots = page.Robots
			}
			if page.ChangeFreq != "" {
				base.ChangeFreq = page.ChangeFreq
			}
			if page.Priority > 0 {
				base.Priority = page.Priority
			}
			if page.InSitemap != nil {
				base.InSitemap = page.InSitemap
			}
			dst.Pages[path] = base
		}
	}
}

func normalize(cfg *Config) {
	cfg.BaseURL = strings.TrimSuffix(strings.TrimSpace(cfg.BaseURL), "/")
	if cfg.Robots == "" {
		cfg.Robots = "index,follow"
	}
	if cfg.Locale == "" {
		cfg.Locale = "zh_CN"
	}
	if cfg.Pages == nil {
		cfg.Pages = map[string]PageMeta{}
	}
}

// AllowAI 判断是否放行大模型爬虫（没配视为放行）。
func (c *Config) AllowAI() bool {
	return c.AllowAICrawlers == nil || *c.AllowAICrawlers
}

func boolPtr(v bool) *bool { return &v }

// PageFor 取某条路径的页面配置；命中不到时返回空结构（视为全站默认）。
func (c *Config) PageFor(urlPath string) PageMeta {
	p := normalizePath(urlPath)
	if meta, ok := c.Pages[p]; ok {
		return meta
	}
	// 前缀匹配兜底：/prompt-gallery/123 走 /prompt-gallery 的配置
	for k, meta := range c.Pages {
		if k != "/" && strings.HasPrefix(p, k+"/") {
			return meta
		}
	}
	return PageMeta{}
}

// privateLabels 给后台/登录类页面一个体面的标题（这些页 noindex，只为标签页好看）。
var privateLabels = map[string]string{
	"/console":         "控制台",
	"/system-settings": "系统设置",
	"/admin":           "管理后台",
	"/login":           "登录",
	"/sign-in":         "登录",
	"/register":        "注册",
	"/sign-up":         "注册",
	"/reset":           "找回密码",
	"/setup":           "初始化",
}

// TitleFor 计算最终 title：页面标题套模板，没页面标题就用全站默认标题。
func (c *Config) TitleFor(urlPath string) string {
	page := c.PageFor(urlPath)
	if page.Title == "" {
		if isPrivatePath(urlPath) {
			p := normalizePath(urlPath)
			for prefix, label := range privateLabels {
				if p == prefix || strings.HasPrefix(p, prefix+"/") {
					return label + " · " + c.SiteName
				}
			}
		}
		return c.DefaultTitle
	}
	// 页面标题里带了站名就不重复拼接
	if strings.Contains(page.Title, c.SiteName) || strings.Contains(page.Title, c.Brand) {
		return page.Title
	}
	if c.TitleTemplate == "" {
		return page.Title
	}
	out := strings.ReplaceAll(c.TitleTemplate, "{page}", page.Title)
	out = strings.ReplaceAll(out, "{site}", c.SiteName)
	return out
}

// DescriptionFor 页面描述优先，其次全站默认。
func (c *Config) DescriptionFor(urlPath string) string {
	if d := c.PageFor(urlPath).Description; d != "" {
		return d
	}
	return c.Description
}

// KeywordsFor 页面关键词优先，其次全站默认。
func (c *Config) KeywordsFor(urlPath string) string {
	if k := c.PageFor(urlPath).Keywords; k != "" {
		return k
	}
	return c.Keywords
}

// RobotsFor 页面 robots 优先；登录墙/管理端路径强制 noindex。
func (c *Config) RobotsFor(urlPath string) string {
	if r := c.PageFor(urlPath).Robots; r != "" {
		return r
	}
	if isPrivatePath(urlPath) {
		return "noindex,follow"
	}
	return c.Robots
}

// Canonical 生成规范链接，去掉查询串与尾部斜杠。
func (c *Config) Canonical(urlPath string) string {
	p := normalizePath(urlPath)
	if p == "/" {
		return c.BaseURL + "/"
	}
	return c.BaseURL + p
}

// normalizePath 统一成「以 / 开头、无尾斜杠」的形式（根路径除外）。
func normalizePath(p string) string {
	if p == "" {
		return "/"
	}
	if i := strings.IndexByte(p, '?'); i >= 0 {
		p = p[:i]
	}
	if i := strings.IndexByte(p, '#'); i >= 0 {
		p = p[:i]
	}
	if !strings.HasPrefix(p, "/") {
		p = "/" + p
	}
	if len(p) > 1 {
		p = strings.TrimSuffix(p, "/")
	}
	return p
}

// isPrivatePath 登录后台、控制台、接口等不该被索引的路径。
func isPrivatePath(p string) bool {
	privatePrefixes := []string{
		"/console", "/system-settings", "/admin", "/login", "/register",
		"/reset", "/oauth", "/api", "/v1", "/setup", "/user/",
	}
	np := normalizePath(p)
	for _, prefix := range privatePrefixes {
		if np == prefix || strings.HasPrefix(np, prefix+"/") {
			return true
		}
	}
	return false
}
