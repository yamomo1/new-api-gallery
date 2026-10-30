package watermark

import (
	"os"
	"path/filepath"
	"strings"
	"sync"

	"golang.org/x/image/font"
	"golang.org/x/image/font/gofont/goregular"
	"golang.org/x/image/font/opentype"
	"golang.org/x/image/font/sfnt"
	"golang.org/x/image/math/fixed"
)

// parsedFont 缓存一份已解析的字体，避免每次打水印都重新解析（解析 TTF 有毫秒级开销）。
type parsedFont struct {
	font *sfnt.Font
	src  string // 来源描述，用于日志
}

var (
	fontMu    sync.RWMutex
	fontCache = map[string]*parsedFont{} // key: 字体文件路径（内嵌字体的 key 为 "__embedded__"）
)

// 系统上常见的中文字体路径，按优先级探测。
// 服务器镜像里装了 fonts-wqy-microhei（见 Dockerfile.cn），
// 本地开发环境（Windows/macOS）也能命中各自的中文字体。
var systemFontCandidates = []string{
	"/usr/share/fonts/truetype/wqy/wqy-microhei.ttc",
	"/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc",
	"/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
	"/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
	"/usr/share/fonts/truetype/droid/DroidSansFallbackFull.ttf",
	"/usr/share/fonts/truetype/arphic/uming.ttc",
	"C:/Windows/Fonts/msyh.ttc",
	"C:/Windows/Fonts/msyhbd.ttc",
	"C:/Windows/Fonts/simhei.ttf",
	"/System/Library/Fonts/PingFang.ttc",
	"/System/Library/Fonts/STHeiti Light.ttc",
}

// resolveFont 返回应使用的字体：自定义路径优先，其次系统字体，最后内嵌拉丁字体。
func resolveFont(cfg Config) *parsedFont {
	if p := cfg.FontPath; p != "" {
		if f := loadFontFile(p); f != nil {
			return f
		}
	}
	if f := loadFontFile(""); f != nil {
		return f
	}
	return nil
}

// loadFontFile 加载并缓存字体。path 为空表示走系统探测链。
func loadFontFile(path string) *parsedFont {
	key := path
	if key == "" {
		key = "__embedded__"
	}

	fontMu.RLock()
	if f, ok := fontCache[key]; ok {
		fontMu.RUnlock()
		return f
	}
	fontMu.RUnlock()

	data, src := readFontData(path)
	if data == nil {
		return nil
	}

	var sf *sfnt.Font
	if isCollection(data) {
		coll, err := opentype.ParseCollection(data)
		if err != nil || coll.NumFonts() == 0 {
			return nil
		}
		sf, err = coll.Font(0)
		if err != nil {
			return nil
		}
	} else {
		parsed, err := opentype.Parse(data)
		if err != nil {
			return nil
		}
		sf = parsed
	}

	pf := &parsedFont{font: sf, src: src}
	fontMu.Lock()
	fontCache[key] = pf
	fontMu.Unlock()
	return pf
}

// readFontData 按优先级取字体字节与来源描述。
func readFontData(path string) ([]byte, string) {
	if path != "" {
		if data, err := os.ReadFile(path); err == nil && len(data) > 0 {
			return data, path
		}
		// 指定路径不可用时不直接失败，继续走系统探测，避免因换机器导致水印全挂
	}
	for _, p := range systemFontCandidates {
		if data, err := os.ReadFile(p); err == nil && len(data) > 0 {
			return data, p
		}
	}
	// 候选路径都没命中（发行版字体目录布局各不相同），扫描常见根目录，
	// 按文件名关键字挑一个大概率含中日韩字形的字体。
	if p := scanFontDirs(); p != "" {
		if data, err := os.ReadFile(p); err == nil && len(data) > 0 {
			return data, p
		}
	}
	// 兜底：内嵌 Go 官方字体，只含 Basic Latin。中文会缺字形，
	// 由 pickText 降级为拉丁文案，保证水印始终能画出来。
	return goregular.TTF, "embedded:goregular"
}

// 文件名里出现这些关键字，基本可以认定覆盖中文
var cjkFontHints = []string{"cjk", "wqy", "microhei", "zenhei", "noto", "hei", "song", "kai", "ming", "pingfang", "yahei", "simsun"}

// scanFontDirs 在常见字体目录里找第一个像样的中文字体。
// 只在固定候选路径全部落空时调用，属于稀疏路径，不做缓存以外的优化。
func scanFontDirs() string {
	roots := []string{
		"/usr/share/fonts",
		"/usr/local/share/fonts",
		"/System/Library/Fonts",
		"C:/Windows/Fonts",
	}
	for _, root := range roots {
		if _, err := os.Stat(root); err != nil {
			continue
		}
		var found string
		_ = filepath.WalkDir(root, func(p string, d os.DirEntry, err error) error {
			if err != nil || d.IsDir() {
				return nil
			}
			lower := strings.ToLower(d.Name())
			if !strings.HasSuffix(lower, ".ttf") && !strings.HasSuffix(lower, ".ttc") && !strings.HasSuffix(lower, ".otf") {
				return nil
			}
			for _, hint := range cjkFontHints {
				if strings.Contains(lower, hint) {
					found = p
					return filepath.SkipAll
				}
			}
			return nil
		})
		if found != "" {
			return found
		}
	}
	return ""
}

// isCollection 判断是否为 TTC/OTC 字体集合（魔数 "ttcf"）。
func isCollection(data []byte) bool {
	return len(data) >= 4 && data[0] == 't' && data[1] == 't' && data[2] == 'c' && data[3] == 'f'
}

// newFace 按像素字号构造可绘制的 font.Face。
func newFace(sf *sfnt.Font, sizePx float64) (font.Face, error) {
	if sizePx < 6 {
		sizePx = 6
	}
	return opentype.NewFace(sf, &opentype.FaceOptions{
		Size:    sizePx,
		DPI:     72, // 72 DPI 时 1pt == 1px，字号即像素高度，便于按图片尺寸换算
		Hinting: font.HintingFull,
	})
}

// hasGlyphs 检查字体是否覆盖 text 中的每个字符。
// 缺字形时 opentype 会画成 .notdef（空心方框），必须提前判断并降级文案。
func hasGlyphs(sf *sfnt.Font, text string) bool {
	var buf sfnt.Buffer
	for _, r := range text {
		if r == ' ' || r == '\t' || r == '\n' {
			continue
		}
		idx, err := sf.GlyphIndex(&buf, r)
		if err != nil || idx == 0 {
			return false
		}
	}
	return true
}

// pickText 返回实际可渲染的文案。
// 若当前字体画不出中文（内嵌字体兜底时），降级到拉丁文案，
// 避免满屏豆腐块——合规上「AI 生成」的中文声明已写入文件元数据，不丢标识。
func pickText(pf *parsedFont, cfg Config) string {
	text := cfg.Text
	if text == "" {
		text = "AI 生成"
	}
	if pf != nil && hasGlyphs(pf.font, text) {
		return text
	}
	// 中文不可渲染时的降级方案
	if pf != nil && hasGlyphs(pf.font, "AI Generated") {
		return "AI Generated"
	}
	return "AI"
}

// measureText 返回文本在给定 face 下的像素宽度。
func measureText(face font.Face, text string) fixed.Int26_6 {
	d := &font.Drawer{Face: face}
	return d.MeasureString(text)
}

// FontSource 返回当前生效的字体来源（文件路径或 embedded:goregular），
// 供后台设置页展示——管理员据此判断中文角标是否会渲染成方框。
func FontSource() string {
	pf := resolveFont(LoadConfig())
	if pf == nil {
		return ""
	}
	return pf.src
}

// FontSupportsChinese 报告当前字体能否渲染中文。
// 为 false 时角标会自动降级为「AI Generated」，但元数据里仍是中文声明。
func FontSupportsChinese() bool {
	pf := resolveFont(LoadConfig())
	if pf == nil {
		return false
	}
	return hasGlyphs(pf.font, "生成")
}
