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
	"encoding/json"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/model"
)

// DetailPathPrefix 是提示词详情页的路径前缀。
// 详情页必须有自己的 URL（/prompt-gallery/123），弹窗形式的
// /prompt-gallery?prompt=123 爬虫抓不到，也分享不出单独的卡片。
const DetailPathPrefix = "/prompt-gallery/"

// DetailMeta 是单条内容页的 SEO 信息，由数据库记录现算。
type DetailMeta struct {
	ID          int64
	Title       string
	Description string
	Keywords    string
	Image       string
	Author      string
	Model       string
	Category    string
	Type        string
	Tags        []string
	PublishedAt int64
	UpdatedAt   int64
	// NotFound 表示 URL 合法但记录不存在/未发布 —— 交给上层返回 404。
	NotFound bool
}

// parseDetailID 从 /prompt-gallery/123 取出 123；不是详情路径返回 false。
// 只认纯数字，避免把 /prompt-gallery/admin 之类的子路径误判成详情。
func parseDetailID(urlPath string) (int64, bool) {
	p := normalizePath(urlPath)
	if !strings.HasPrefix(p, DetailPathPrefix) {
		return 0, false
	}
	rest := p[len(DetailPathPrefix):]
	if rest == "" || strings.Contains(rest, "/") {
		return 0, false
	}
	id, err := strconv.ParseInt(rest, 10, 64)
	if err != nil || id <= 0 {
		return 0, false
	}
	return id, true
}

// ResolveDetail 把详情路径解析成 SEO 元信息。
// 非详情路径返回 nil；详情路径但查不到记录返回 NotFound 标记。
//
// 数据库查询只发生在详情路径上，列表页/首页等常见路径没有额外开销。
func ResolveDetail(urlPath string) *DetailMeta {
	id, ok := parseDetailID(urlPath)
	if !ok {
		return nil
	}
	// 启动早期 DB 还没连上时不要 panic，退回全站默认 SEO 即可
	if model.DB == nil {
		return nil
	}
	item, err := model.GetPromptGalleryById(id)
	if err != nil || item == nil {
		return &DetailMeta{ID: id, NotFound: true}
	}

	meta := &DetailMeta{
		ID:          item.Id,
		Title:       strings.TrimSpace(item.Title),
		Author:      item.Author,
		Model:       item.Model,
		Category:    item.Category,
		Type:        item.Type,
		Tags:        parseListField(item.Tags),
		Image:       absoluteURL(item.Cover),
		PublishedAt: item.CreatedAt,
		UpdatedAt:   item.UpdatedAt,
	}
	if meta.Image == "" {
		// cover 没填时退到 media 的第一条（视频条目常见）
		if media := parseListField(item.Media); len(media) > 0 {
			meta.Image = absoluteURL(media[0])
			if strings.HasSuffix(strings.ToLower(media[0]), ".mp4") {
				meta.Type = "video"
			}
		}
	}
	meta.Description = detailDescription(item)
	meta.Keywords = detailKeywords(meta)
	return meta
}

// detailDescription 用提示词正文本身做描述 —— 这是搜索意图的原话，
// 比任何人工文案都更匹配长尾查询。超长按 rune 截断，避免多字节截半。
func detailDescription(item *model.PromptGallery) string {
	body := strings.Join(strings.Fields(item.Prompt), " ")
	if body == "" {
		body = item.Title
	}
	body = truncateRunes(body, 110)
	if body == "" {
		return ""
	}
	suffix := "。一幕AI 提示词画廊收录的 AI 提示词，中英双语对照，可直接复制到 ComfyUI、Flux、Stable Diffusion、可灵、Seedance 使用。"
	return body + suffix
}

func detailKeywords(meta *DetailMeta) string {
	seen := make(map[string]struct{}, len(meta.Tags)+6)
	parts := make([]string, 0, len(meta.Tags)+6)
	add := func(v string) {
		v = strings.TrimSpace(v)
		if v == "" {
			return
		}
		if _, ok := seen[v]; ok {
			return
		}
		seen[v] = struct{}{}
		parts = append(parts, v)
	}
	for _, tag := range meta.Tags {
		add(tag)
	}
	add(meta.Model)
	add(meta.Category)
	if meta.Type == "video" {
		add("AI视频提示词")
		add("视频提示词")
	} else {
		add("AI绘画提示词")
		add("图片提示词")
	}
	add("提示词")
	add("一幕AI")
	return strings.Join(parts, ",")
}

// parseListField 兼容两种历史写法：JSON 数组字符串 与 逗号分隔字符串。
func parseListField(raw string) []string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil
	}
	if strings.HasPrefix(raw, "[") {
		var arr []string
		if err := json.Unmarshal([]byte(raw), &arr); err == nil {
			out := make([]string, 0, len(arr))
			for _, v := range arr {
				if v = strings.TrimSpace(v); v != "" {
					out = append(out, v)
				}
			}
			return out
		}
	}
	fields := strings.FieldsFunc(raw, func(r rune) bool { return r == ',' || r == '，' })
	out := make([]string, 0, len(fields))
	for _, v := range fields {
		if v = strings.TrimSpace(v); v != "" {
			out = append(out, v)
		}
	}
	return out
}

// absoluteURL 保证社交卡片能取到图（OG 必须是绝对地址）。
// data: 内联图（早期种子数据用 svg data URI 占位）不是可取回的资源，
// 直接返回空让上层退回站点默认 OG 图 —— 否则会拼出 data:image/... 这种坏地址。
func absoluteURL(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return ""
	}
	if strings.HasPrefix(raw, "data:") {
		return ""
	}
	if strings.HasPrefix(raw, "http://") || strings.HasPrefix(raw, "https://") {
		return raw
	}
	return LoadConfig().BaseURL + "/" + strings.TrimPrefix(raw, "/")
}

func truncateRunes(s string, max int) string {
	if max <= 0 || utf8.RuneCountInString(s) <= max {
		return s
	}
	runes := []rune(s)
	return strings.TrimSpace(string(runes[:max])) + "…"
}

func isoTime(ts int64) string {
	if ts <= 0 {
		return ""
	}
	return time.Unix(ts, 0).UTC().Format(time.RFC3339)
}
