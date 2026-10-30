package watermark

import (
	"bytes"
	"fmt"
	"image"
	"image/color"
	"image/gif"
	"image/jpeg"
	"image/png"
	"math"
	"strconv"
	"strings"

	xdraw "golang.org/x/image/draw"
	"golang.org/x/image/font"
	"golang.org/x/image/math/fixed"
	_ "golang.org/x/image/webp"
)

// jpegQuality 重编码质量。水印必须重编码，用 92 在体积与画质间取平衡；
// 原图是 PNG（无损）时保持 PNG，不会引入压缩损失。
const jpegQuality = 92

// drawBadge 在图片上绘制显式水印角标，返回新编码的图片字节。
// 只处理 PNG / JPEG / GIF(首帧) / WebP，其它格式原样返回。
func drawBadge(data []byte, contentType string, cfg Config) ([]byte, error) {
	src, format, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		return nil, fmt.Errorf("解码图片失败: %w", err)
	}

	pf := resolveFont(cfg)
	if pf == nil {
		return nil, fmt.Errorf("没有可用字体")
	}

	b := src.Bounds()
	w, h := b.Dx(), b.Dy()
	if w < 32 || h < 32 {
		// 极小的图（表情、图标）不画角标，否则整张图都被水印盖住
		return nil, fmt.Errorf("图片过小（%dx%d），跳过显式水印", w, h)
	}

	// 统一转 RGBA 画布（原图可能是 YCbCr / Paletted / NRGBA）
	canvas := image.NewRGBA(image.Rect(0, 0, w, h))
	xdraw.Draw(canvas, canvas.Bounds(), src, b.Min, xdraw.Src)

	shortest := w
	if h < shortest {
		shortest = h
	}
	sizePx := float64(shortest) / float64(cfg.FontScale)
	if sizePx < 11 {
		sizePx = 11
	}
	if sizePx > 180 {
		sizePx = 180
	}

	face, err := newFace(pf.font, sizePx)
	if err != nil {
		return nil, fmt.Errorf("构造字体失败: %w", err)
	}
	defer face.Close()

	text := pickText(pf, cfg)
	textW := measureText(face, text).Ceil()
	if textW <= 0 {
		return nil, fmt.Errorf("水印文本为空")
	}

	metrics := face.Metrics()
	textH := (metrics.Ascent + metrics.Descent).Ceil()

	padX := int(math.Round(sizePx * 0.55))
	padY := int(math.Round(sizePx * 0.30))
	boxW := textW + padX*2
	boxH := textH + padY*2

	margin := int(math.Round(float64(shortest) / 45.0))
	if margin < 8 {
		margin = 8
	}

	boxX, boxY := badgeOrigin(cfg.Position, w, h, boxW, boxH, margin)

	alpha := uint8(255 * cfg.Opacity / 100)
	if cfg.BgEnabled {
		// 底衬用与文字相反的黑/白，保证任何画面上都能读清楚
		var bg color.RGBA
		if isLightColor(cfg.Color) {
			bg = color.RGBA{R: 0, G: 0, B: 0, A: uint8(float64(alpha) * 0.42)}
		} else {
			bg = color.RGBA{R: 255, G: 255, B: 255, A: uint8(float64(alpha) * 0.55)}
		}
		radius := float64(boxH) * 0.34
		fillRoundRect(canvas, boxX, boxY, boxW, boxH, radius, bg)
	}

	fg := parseHexColor(cfg.Color)
	fg.A = alpha
	d := &font.Drawer{
		Dst:  canvas,
		Src:  image.NewUniform(fg),
		Face: face,
		Dot: fixed.Point26_6{
			X: fixed.I(boxX + padX),
			// 基线 = 框顶 + 上内边距 + 上升高度
			Y: fixed.I(boxY + padY + metrics.Ascent.Ceil()),
		},
	}
	d.DrawString(text)

	return encodeLike(canvas, format, contentType)
}

// badgeOrigin 按位置配置算出角标左上角坐标。
func badgeOrigin(pos string, w, h, boxW, boxH, margin int) (int, int) {
	switch pos {
	case PosTopLeft:
		return margin, margin
	case PosTopRight:
		return w - boxW - margin, margin
	case PosBottomLeft:
		return margin, h - boxH - margin
	case PosCenter:
		return (w - boxW) / 2, (h - boxH) / 2
	default: // PosBottomRight
		return w - boxW - margin, h - boxH - margin
	}
}

// encodeLike 用与原图一致的格式重新编码；无法编码的格式退回 PNG。
func encodeLike(img image.Image, decodedFormat, contentType string) ([]byte, error) {
	var buf bytes.Buffer
	format := decodedFormat
	if format == "" {
		format = strings.TrimPrefix(contentType, "image/")
	}
	switch format {
	case "jpeg", "jpg":
		if err := jpeg.Encode(&buf, img, &jpeg.Options{Quality: jpegQuality}); err != nil {
			return nil, err
		}
		return buf.Bytes(), nil
	case "png":
		enc := png.Encoder{CompressionLevel: png.DefaultCompression}
		if err := enc.Encode(&buf, img); err != nil {
			return nil, err
		}
		return buf.Bytes(), nil
	default:
		// GIF / WebP 等：Go 标准库无法编码，统一退回 PNG。
		// 调用方会依据返回的 contentType 更新存储扩展名。
		enc := png.Encoder{CompressionLevel: png.DefaultCompression}
		if err := enc.Encode(&buf, img); err != nil {
			return nil, err
		}
		return buf.Bytes(), nil
	}
}

// fillRoundRect 在画布上填充一个带抗锯齿圆角的矩形。
// 逐像素按到圆心的距离计算覆盖率，边缘不会出现硬锯齿。
func fillRoundRect(dst *image.RGBA, x, y, w, h int, radius float64, c color.RGBA) {
	if w <= 0 || h <= 0 {
		return
	}
	if radius > float64(h)/2 {
		radius = float64(h) / 2
	}
	if radius > float64(w)/2 {
		radius = float64(w) / 2
	}

	// 一次性算好源色，避免每个像素重复换算
	sr := float64(c.R)
	sg := float64(c.G)
	sb := float64(c.B)
	sa := float64(c.A) / 255.0

	bounds := dst.Bounds()
	for py := y; py < y+h; py++ {
		if py < bounds.Min.Y || py >= bounds.Max.Y {
			continue
		}
		for px := x; px < x+w; px++ {
			if px < bounds.Min.X || px >= bounds.Max.X {
				continue
			}
			// 圆角覆盖：判断像素点是否落在四个角的圆外
			cov := 1.0
			cx, cy := float64(px)+0.5, float64(py)+0.5
			if d := cornerDistance(cx, cy, float64(x), float64(y), float64(x+w), float64(y+h), radius); d > 0 {
				cov = 1 - d
				if cov <= 0 {
					continue
				}
			}
			a := sa * cov
			if a <= 0.001 {
				continue
			}
			// 与已有像素做 source-over 混合
			off := dst.PixOffset(px, py)
			dr := float64(dst.Pix[off])
			dg := float64(dst.Pix[off+1])
			db := float64(dst.Pix[off+2])
			da := float64(dst.Pix[off+3]) / 255.0
			outA := a + da*(1-a)
			if outA <= 0 {
				continue
			}
			dst.Pix[off] = uint8((sr*a + dr*da*(1-a)) / outA)
			dst.Pix[off+1] = uint8((sg*a + dg*da*(1-a)) / outA)
			dst.Pix[off+2] = uint8((sb*a + db*da*(1-a)) / outA)
			dst.Pix[off+3] = uint8(outA * 255)
		}
	}
}

// cornerDistance 返回像素点到最近圆角圆心超出半径的距离（像素），
// 在矩形内部时返回 0 或负数。
func cornerDistance(cx, cy, x0, y0, x1, y1, r float64) float64 {
	// 四个圆心
	type pt struct{ x, y float64 }
	corners := [4]pt{
		{x0 + r, y0 + r},
		{x1 - r, y0 + r},
		{x0 + r, y1 - r},
		{x1 - r, y1 - r},
	}
	best := math.Inf(-1)
	for _, c := range corners {
		// 只有落在该角所属象限的点才需要判断
		inX := (c.x == x0+r && cx < c.x) || (c.x == x1-r && cx > c.x)
		inY := (c.y == y0+r && cy < c.y) || (c.y == y1-r && cy > c.y)
		if !inX || !inY {
			continue
		}
		d := math.Hypot(cx-c.x, cy-c.y) - r
		if d > best {
			best = d
		}
	}
	if math.IsInf(best, -1) {
		return 0
	}
	return best
}

// parseHexColor 解析 #RGB / #RRGGBB / #RRGGBBAA，非法时返回白色。
func parseHexColor(s string) color.RGBA {
	s = strings.TrimSpace(strings.TrimPrefix(strings.TrimSpace(s), "#"))
	switch len(s) {
	case 3:
		s = string([]byte{s[0], s[0], s[1], s[1], s[2], s[2]})
	case 8:
		// 忽略 alpha，alpha 由 Opacity 统一控制
		s = s[:6]
	}
	if len(s) != 6 {
		return color.RGBA{R: 255, G: 255, B: 255, A: 255}
	}
	v, err := strconv.ParseUint(s, 16, 32)
	if err != nil {
		return color.RGBA{R: 255, G: 255, B: 255, A: 255}
	}
	return color.RGBA{
		R: uint8(v >> 16),
		G: uint8(v >> 8),
		B: uint8(v),
		A: 255,
	}
}

// isLightColor 判断颜色是否偏亮（用于决定底衬取黑还是白）。
func isLightColor(hex string) bool {
	c := parseHexColor(hex)
	// 感知亮度加权（ITU-R BT.601）
	lum := 0.299*float64(c.R) + 0.587*float64(c.G) + 0.114*float64(c.B)
	return lum > 140
}

// isGIF 判断是否为 GIF（动图重编码会掉帧，只写元数据不做显式）。
func isGIF(data []byte) bool {
	return len(data) > 6 && string(data[:6]) == "GIF87a" || len(data) > 6 && string(data[:6]) == "GIF89a"
}

// gifFirstFrame 仅供测试与调试：确认 GIF 能被解码。
func gifFirstFrame(data []byte) (image.Image, error) {
	g, err := gif.DecodeAll(bytes.NewReader(data))
	if err != nil {
		return nil, err
	}
	if len(g.Image) == 0 {
		return nil, fmt.Errorf("GIF 无帧")
	}
	return g.Image[0], nil
}
