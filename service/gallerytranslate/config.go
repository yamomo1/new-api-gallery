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

// Package gallerytranslate 负责「提示词自动翻译」的服务端实现。
//
// 为什么要把这件事挪到服务端：
//  1. 约束大模型的提示词（system prompt）要能在后台改 —— 不同模型吃不同的套路，
//     上线了新约束/新模型，管理员得自己试，不能每次都改代码发版。
//  2. 次数限制必须服务端统计 —— 前端计数形同虚设，curl 两下就绕过。
//  3. 走哪个模型要管理员指定，避免用户把昂贵的推理模型拿来干翻译这种轻活。
package gallerytranslate

import (
	"encoding/json"
	"strings"
	"sync"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

// OptionKey 后台保存配置用的 Option 键名。
const OptionKey = "GalleryTranslateConfig"

// Config 是完整的翻译配置，JSON 存在 OptionMap["GalleryTranslateConfig"]。
type Config struct {
	// Enabled 关掉后直接返回「翻译功能已关闭」，不再调用模型。
	Enabled bool `json:"enabled"`
	// Model 后台指定的翻译模型（走 Distribute 按名字路由）。
	// 留空表示「跟随用户可用模型」，由前端/后端自动挑一个对话模型。
	Model string `json:"model"`
	// SystemPrompt 约束大模型的提示词，管理员可在后台直接改。
	SystemPrompt string `json:"systemPrompt"`
	// UserPromptTemplate 包住原文的信封，{text} 会被替换成待翻译内容。
	// 留空则用内置信封。
	UserPromptTemplate string `json:"userPromptTemplate"`
	// Temperature 翻译任务不需要创意，默认低温。
	Temperature float64 `json:"temperature"`
	// MaxChars 单次翻译的最大字符数，超出截断，防止有人塞长文烧 token。
	MaxChars int `json:"maxChars"`
	// DailyLimit 每个用户每日免费次数；0 表示不限。
	DailyLimit int `json:"dailyLimit"`
	// OverageEnabled 超出免费次数后是否允许继续（扣额度）。
	OverageEnabled bool `json:"overageEnabled"`
	// OverageQuota 超出后每次额外扣除的额度。
	// 单位是系统 quota 单位（QuotaPerUnit = 500000 ≈ $1）。
	OverageQuota int `json:"overageQuota"`
	// Notice 前台展示的规则文案。留空则前端按上面的设置自动生成。
	Notice string `json:"notice"`
}

// DefaultSystemPrompt 是内置的约束提示词。
//
// 三条血泪经验都写在这了：
//  1. 必须明确「你不是聊天机器人」—— 只说 "You are a translation engine"
//     的话，Gemini Flash 这类模型遇到「你好」会直接自我介绍。
//  2. 必须举出禁例（"I am"、"Here is the translation"），比抽象规则有效得多。
//  3. 必须说明短句/问候语也要照样翻译，不是对话开场白。
const DefaultSystemPrompt = `You are a translation engine. You are NOT a chatbot and you must never speak as one.
Your ONLY job: return the English translation of the text inside the <translate> tag.

HARD RULES (violating any of these is a critical failure):
1. Output ONLY the translated text. No explanations, no quotes, no prefixes, no notes.
2. NEVER introduce yourself, never say who you are, never greet the user,
   never ask questions, never add any sentence that is not the translation itself.
   Forbidden examples: "I am ...", "我是...", "Here is the translation", "Hello!".
3. If the input is a greeting or short phrase (e.g. 你好), just output its translation
   (e.g. Hello). It is NOT a conversation opener — do not reply to it.
4. Preserve the original structure: commas, line breaks, weights like (word:1.2),
   LoRA tags like <lora:name:0.8>, and special tokens. Do not add, remove or "improve" content.
5. If the input is already English, return it unchanged.
6. Keep model trigger words, artist names, and brand names untranslated.`

// DefaultUserPromptTemplate 是包住原文的信封，{text} 会被替换。
const DefaultUserPromptTemplate = `Translate the text inside the <translate> tag to English.
Reply with the translation ONLY — nothing else.
<translate>
{text}
</translate>`

// DefaultConfig 返回内置默认值。
func DefaultConfig() *Config {
	return &Config{
		Enabled:            true,
		Model:              "",
		SystemPrompt:       DefaultSystemPrompt,
		UserPromptTemplate: DefaultUserPromptTemplate,
		Temperature:        0.2,
		MaxChars:           4000,
		// 默认给 10 次免费额度：够正常投稿用，又不至于被当成免费翻译 API。
		DailyLimit:     10,
		OverageEnabled: true,
		// 1000 quota ≈ $0.002（QuotaPerUnit = 500000）。
		OverageQuota: 1000,
		Notice:       "",
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
	normalize(cfg)

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

func mergeConfig(dst *Config, patch *Config) {
	// Enabled / OverageEnabled 是 bool，没法用空值区分「没配」和「显式关闭」，
	// 所以直接采用 patch 的值 —— 后台每次保存都会带上这两个开关。
	dst.Enabled = patch.Enabled
	dst.OverageEnabled = patch.OverageEnabled
	if patch.Model != "" {
		dst.Model = patch.Model
	}
	if patch.SystemPrompt != "" {
		dst.SystemPrompt = patch.SystemPrompt
	}
	if patch.UserPromptTemplate != "" {
		dst.UserPromptTemplate = patch.UserPromptTemplate
	}
	if patch.Temperature != 0 {
		dst.Temperature = patch.Temperature
	}
	if patch.MaxChars != 0 {
		dst.MaxChars = patch.MaxChars
	}
	if patch.DailyLimit != 0 {
		dst.DailyLimit = patch.DailyLimit
	}
	if patch.OverageQuota != 0 {
		dst.OverageQuota = patch.OverageQuota
	}
	if patch.Notice != "" {
		dst.Notice = patch.Notice
	}
}

// normalize 收敛不合理的值，避免后台填错把功能玩坏。
func normalize(c *Config) {
	if c.Temperature < 0 {
		c.Temperature = 0
	}
	if c.Temperature > 2 {
		c.Temperature = 2
	}
	if c.MaxChars <= 0 {
		c.MaxChars = 4000
	}
	if c.MaxChars > 20000 {
		c.MaxChars = 20000
	}
	if c.DailyLimit < 0 {
		c.DailyLimit = 0
	}
	if c.OverageQuota < 0 {
		c.OverageQuota = 0
	}
	if strings.TrimSpace(c.SystemPrompt) == "" {
		c.SystemPrompt = DefaultSystemPrompt
	}
	if !strings.Contains(c.UserPromptTemplate, "{text}") {
		c.UserPromptTemplate = DefaultUserPromptTemplate
	}
}

// BuildUserPrompt 把待翻译文本填进信封。
func BuildUserPrompt(cfg *Config, text string) string {
	return strings.ReplaceAll(cfg.UserPromptTemplate, "{text}", text)
}

// SaveConfig 落库并立即让缓存失效。
func SaveConfig(raw string) error {
	if err := model.UpdateOption(OptionKey, raw); err != nil {
		return err
	}
	ResetCache()
	return nil
}
