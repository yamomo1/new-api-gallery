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

// Package gallerycreate 负责「去创作」四个功能的开关与数据装配。
//
// 四个功能：
//  1. NetdiskDownload —— 网盘手动下载：前台展示模型在网盘（如夸克）的分享链接，
//     客户点开自行下载，不自动拉取（规避限速/登录态问题）。
//  2. ComfyUINode     —— ComfyUI 自定义节点一键生图：客户本地装了本站的 ComfyUI
//     节点后，点「去创作」唤起本地 ComfyUI 自动下模型、加载工作流出图。
//  3. RunningHub      —— RunningHub 云端 ComfyUI：点「去创作」跳转 RunningHub
//     云端工作流体验页（云端 GPU 出图，无需本地安装）。
//  4. ManualWorkflow  —— 手动 Load / 拖入工作流：前台提供 ComfyUI 工作流 JSON
//     下载，客户在自己 ComfyUI 里手动加载（零安装）。
//
// 开关集中存在 OptionMap["GalleryCreateConfig"]，后台随时可改、立即生效，
// 不用发版。前端读取后只渲染被打开的那几项。
package gallerycreate

import (
	"encoding/json"
	"strings"
	"sync"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

// OptionKey 后台保存配置用的 Option 键名。
const OptionKey = "GalleryCreateConfig"

// Feature 是四个功能开关的键名（与前端、配置 JSON 字段保持一致）。
type Feature string

const (
	FeatureNetdiskDownload Feature = "netdisk_download"
	FeatureComfyUINode     Feature = "comfyui_node"
	FeatureRunningHub      Feature = "runninghub"
	FeatureManualWorkflow  Feature = "manual_workflow"
)

// Config 是「去创作」开关配置，JSON 存在 OptionMap["GalleryCreateConfig"]。
// 四个开关默认全开，后台可逐个关闭；前端按此决定展示哪些入口。
type Config struct {
	// NetdiskDownload 网盘手动下载入口（展示网盘分享链接）。
	NetdiskDownload bool `json:"netdisk_download"`
	// ComfyUINode 本地 ComfyUI 自定义节点一键生图入口。
	ComfyUINode bool `json:"comfyui_node"`
	// RunningHub 云端 ComfyUI（RunningHub）入口。
	RunningHub bool `json:"runninghub"`
	// ManualWorkflow 手动下载工作流 JSON / 拖入入口（零安装）。
	ManualWorkflow bool `json:"manual_workflow"`
}

// DefaultConfig 返回内置默认值（四个全开）。
func DefaultConfig() *Config {
	return &Config{
		NetdiskDownload: true,
		ComfyUINode:     true,
		RunningHub:      true,
		ManualWorkflow:  true,
	}
}

var (
	cacheMu     sync.RWMutex
	cachedRaw   string
	cachedValue *Config
)

// LoadConfig 读取后台配置并与默认值合并，结果做一次快照缓存
// （按 Option 原始字符串判断是否变化，避免每请求反序列化）。
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
		var patch Config
		if err := json.Unmarshal([]byte(raw), &patch); err == nil {
			mergeConfig(cfg, &patch)
		}
	}

	cacheMu.Lock()
	cachedRaw = raw
	cachedValue = cfg
	cacheMu.Unlock()
	return cfg
}

// ResetCache 供「保存后立即生效」使用。
func ResetCache() {
	cacheMu.Lock()
	cachedRaw = ""
	cachedValue = nil
	cacheMu.Unlock()
}

// mergeConfig 把后台保存的值合进默认值。四个都是 bool，直接采用 patch 的值
// （后台每次保存都带上这四个开关，空值无意义）。
func mergeConfig(dst *Config, patch *Config) {
	dst.NetdiskDownload = patch.NetdiskDownload
	dst.ComfyUINode = patch.ComfyUINode
	dst.RunningHub = patch.RunningHub
	dst.ManualWorkflow = patch.ManualWorkflow
}

// SaveConfig 落库并立即让缓存失效。
func SaveConfig(raw string) error {
	if err := model.UpdateOption(OptionKey, raw); err != nil {
		return err
	}
	ResetCache()
	return nil
}
