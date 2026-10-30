package watermark

import (
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
)

// 水印位置取值
const (
	PosTopLeft     = "top-left"
	PosTopRight    = "top-right"
	PosBottomLeft  = "bottom-left"
	PosBottomRight = "bottom-right"
	PosCenter      = "center"
)

// Config 是水印设置的全量快照，由后台「系统设置 - 内容标识」维护。
//
// 显式标识（画面角标）与隐式标识（文件元数据）相互独立、可单独开关。
// 《人工智能生成合成内容标识办法》要求两者兼备，但灰度期允许只开其中一项。
type Config struct {
	Enabled  bool // 总开关
	Explicit bool // 显式角标（烧进画面）
	Implicit bool // 隐式元数据（写进文件）

	Text      string // 显式角标文案
	Position  string // 角标位置
	Opacity   int    // 角标不透明度 0-100
	FontScale int    // 字号 = 图片最短边 / FontScale
	Color     string // 文字颜色 #RRGGBB
	BgEnabled bool   // 是否绘制半透明圆角底衬
	FontPath  string // 自定义字体文件（.ttf/.ttc/.otf），空则自动探测

	ProviderName string // 服务提供者名称，写入隐式元数据
	DeclareText  string // 隐式标识声明语

	FFmpegPath    string // ffmpeg 可执行文件路径，空则自动探测
	VideoMaxSec   int    // 视频烧角标的最长时长（秒），0 表示不限制
	VideoMaxBytes int64  // 视频烧角标的最大字节数，0 表示不限制
}

// LoadConfig 读取当前水印设置。每次调用都重新取快照，
// 后台改配置后下一次处理立即生效，无需重启。
func LoadConfig() Config {
	v := snapshot()

	return Config{
		Enabled:  v.boolean("WatermarkEnabled", true),
		Explicit: v.boolean("WatermarkExplicit", true),
		Implicit: v.boolean("WatermarkImplicit", true),

		Text:      v.text("WatermarkText", "AI 生成"),
		Position:  normalizePosition(v.text("WatermarkPosition", PosBottomRight)),
		Opacity:   clampInt(v.integer("WatermarkOpacity", 78), 10, 100),
		FontScale: clampInt(v.integer("WatermarkFontScale", 26), 8, 200),
		Color:     v.text("WatermarkColor", "#FFFFFF"),
		BgEnabled: v.boolean("WatermarkBgEnabled", true),
		FontPath:  v.text("WatermarkFontPath", ""),

		ProviderName: v.text("WatermarkProviderName", v.text("SystemName", "cdymm")),
		DeclareText:  v.text("WatermarkDeclareText", "本内容由人工智能生成合成"),

		FFmpegPath:    v.text("WatermarkFFmpegPath", ""),
		VideoMaxSec:   v.integer("WatermarkVideoMaxSeconds", 60),
		VideoMaxBytes: int64(v.integer("WatermarkVideoMaxMB", 50)) << 20,
	}
}

// ContentID 返回本次处理内容的编号，用于隐式元数据的「内容编号」字段。
func (c Config) ContentID() string { return contentID() }

// optionView 是一次读取内使用的 OptionMap 只读副本。
//
// OptionMap 是全局 map，后台保存设置时会被写入。这里统一加读锁复制一份，
// 避免「上传请求读 + 设置页写」并发触发 concurrent map read/write；
// 同时保证同一次处理读到的是同一时刻的一组配置，不会中途被改。
type optionView struct{ m map[string]string }

func snapshot() optionView {
	common.OptionMapRWMutex.RLock()
	m := make(map[string]string, len(common.OptionMap))
	for k, val := range common.OptionMap {
		m[k] = val
	}
	common.OptionMapRWMutex.RUnlock()
	return optionView{m: m}
}

func (v optionView) text(key, def string) string {
	if s := strings.TrimSpace(v.m[key]); s != "" {
		return s
	}
	return def
}

func (v optionView) boolean(key string, def bool) bool {
	s := strings.TrimSpace(v.m[key])
	if s == "" {
		return def
	}
	return s == "true"
}

func (v optionView) integer(key string, def int) int {
	s := strings.TrimSpace(v.m[key])
	if s == "" {
		return def
	}
	n, err := strconv.Atoi(s)
	if err != nil {
		return def
	}
	return n
}

func normalizePosition(p string) string {
	switch strings.ToLower(strings.TrimSpace(p)) {
	case PosTopLeft, "topleft", "left-top":
		return PosTopLeft
	case PosTopRight, "topright", "right-top":
		return PosTopRight
	case PosBottomLeft, "bottomleft", "left-bottom":
		return PosBottomLeft
	case PosCenter, "middle", "center-center":
		return PosCenter
	default:
		return PosBottomRight
	}
}

func clampInt(v, lo, hi int) int {
	if v < lo {
		return lo
	}
	if v > hi {
		return hi
	}
	return v
}
