package model

import (
	"strings"
	"time"

	"github.com/QuantumNous/new-api/constant"
)

/*
公开模型目录：把「模型资料」（说明 / 图标 / 标签）与「可用性」（端点类型 / 启用分组）
合成一份前台可直接渲染的列表。

为什么要新接口而不是复用 /api/models/：
  - 那条是 AdminAuth，前台用户拿不到；
  - /api/pricing 有端点类型但没有说明、图标、标签；
  - 前台「选择模型」弹窗需要三样一起：图标、一句话说明、能力标签。

分类口径（优先级从高到低）：
  1. 标签里显式写 `图片`/`image` → image，`视频`/`video` → video（运营可覆盖）
  2. 端点类型含 image_generation → image，含 openai_video → video
  3. 模型名关键词兜底（seedream / seedance / kling …）
  都不命中则归为 text，前台生成器不展示。
*/

// PublicModelEntry 前台模型卡片所需的最小字段集
type PublicModelEntry struct {
	ModelName  string   `json:"model_name"`
	Category   string   `json:"category"`
	Description string   `json:"description,omitempty"`
	Icon       string   `json:"icon,omitempty"`
	Tags       []string `json:"tags,omitempty"`
	// New 由创建时间推断（30 天内），对应前台的 NEW 角标
	New bool `json:"new,omitempty"`
	// VendorName / VendorIcon 用于卡片在模型未配图标时回退
	VendorName string `json:"vendor_name,omitempty"`
	VendorIcon string `json:"vendor_icon,omitempty"`
	// Endpoints 便于前端按能力再筛一次
	Endpoints []string `json:"endpoints,omitempty"`
}

const newBadgeWindow = 30 * 24 * time.Hour

var imageKeywords = []string{
	"seedream", "qwen-image", "qwen-edit", "flux", "nano-banana", "dall-e",
	"gpt-image", "imagen", "stable-diffusion", "midjourney", "kolors", "hunyuan-image",
	"图片", "绘图", "生图",
}

var videoKeywords = []string{
	"seedance", "kling", "hailuo", "veo", "sora", "runway", "pika", "wan-",
	"wanx", "minimax-h", "vidu", "视频", "影片",
}

func classifyModel(name string, endpoints []constant.EndpointType, tags []string) string {
	// 1. 标签显式声明优先（运营可覆盖自动判定）
	for _, tag := range tags {
		lower := strings.ToLower(strings.TrimSpace(tag))
		switch lower {
		case "图片", "image", "图像":
			return "image"
		case "视频", "video":
			return "video"
		}
	}
	// 2. 端点类型
	for _, endpoint := range endpoints {
		switch endpoint {
		case constant.EndpointTypeImageGeneration:
			return "image"
		case constant.EndpointTypeOpenAIVideo:
			return "video"
		}
	}
	// 3. 名称兜底
	lower := strings.ToLower(name)
	for _, keyword := range imageKeywords {
		if strings.Contains(lower, keyword) {
			return "image"
		}
	}
	for _, keyword := range videoKeywords {
		if strings.Contains(lower, keyword) {
			return "video"
		}
	}
	return "text"
}

func splitTags(raw string) []string {
	if strings.TrimSpace(raw) == "" {
		return nil
	}
	parts := strings.FieldsFunc(raw, func(r rune) bool {
		return r == ',' || r == '，' || r == ';' || r == '；'
	})
	tags := make([]string, 0, len(parts))
	for _, part := range parts {
		if trimmed := strings.TrimSpace(part); trimmed != "" {
			tags = append(tags, trimmed)
		}
	}
	return tags
}

// GetPublicModelCatalog 返回当前可用模型的公开档案（按名称升序）
func GetPublicModelCatalog() []PublicModelEntry {
	pricing := GetPricing()
	if len(pricing) == 0 {
		return []PublicModelEntry{}
	}

	// 模型资料：exact / prefix / suffix / contains 依次匹配，规则同后台表格的“名称规则”
	records, err := GetAllModels(0, 100000)
	if err != nil {
		records = nil
	}
	metaByRule := map[int][]*Model{}
	for _, record := range records {
		if record == nil {
			continue
		}
		metaByRule[record.NameRule] = append(metaByRule[record.NameRule], record)
	}
	lookupMeta := func(name string) *Model {
		for _, rule := range []int{NameRuleExact, NameRulePrefix, NameRuleSuffix, NameRuleContains} {
			for _, record := range metaByRule[rule] {
				if record.MatchesName(name) {
					return record
				}
			}
		}
		return nil
	}

	vendorIcons := map[string]string{}
	for _, vendor := range GetVendors() {
		vendorIcons[vendor.Name] = vendor.Icon
	}

	now := time.Now()
	result := make([]PublicModelEntry, 0, len(pricing))
	for _, item := range pricing {
		meta := lookupMeta(item.ModelName)

		endpoints := make([]string, 0, len(item.SupportedEndpointTypes))
		for _, endpoint := range item.SupportedEndpointTypes {
			endpoints = append(endpoints, string(endpoint))
		}

		entry := PublicModelEntry{
			ModelName:  item.ModelName,
			VendorName: item.OwnerBy,
			VendorIcon: vendorIcons[item.OwnerBy],
			Endpoints:  endpoints,
		}
		if meta != nil {
			entry.Description = meta.Description
			entry.Icon = meta.Icon
			entry.Tags = splitTags(meta.Tags)
			if meta.CreatedTime > 0 &&
				now.Sub(time.Unix(meta.CreatedTime, 0)) <= newBadgeWindow {
				entry.New = true
			}
		}
		entry.Category = classifyModel(item.ModelName, item.SupportedEndpointTypes, entry.Tags)
		result = append(result, entry)
	}
	return result
}
