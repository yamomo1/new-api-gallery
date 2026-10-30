package watermark

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
)

// Result 是一次水印处理的结果。
type Result struct {
	Data        []byte
	ContentType string
	Ext         string // 建议的文件扩展名（含点），格式转换后可能与原扩展名不同
	Media       string // image / video / unknown
	Explicit    bool   // 是否成功打上显式角标
	Implicit    bool   // 是否成功写入隐式元数据
	Skipped     bool   // 总开关关闭或格式不支持，未做任何改动
	ExplicitErr error  // 显式水印失败原因（不阻断上传，仅记日志）
	ImplicitErr error
}

// Changed 表示文件是否真的被改写。
func (r Result) Changed() bool { return r.Explicit || r.Implicit }

// Process 对媒体文件施加生成内容标识：
//   - 隐式：把「AI 生成属性 / 服务提供者 / 内容编号」写进文件元数据；
//   - 显式：在画面右下角等处烧上可读角标。
//
// 处理顺序固定为「先显式、后隐式」——因为显式需要重新编码，
// 会把之前写入的元数据冲掉，反过来才安全。
//
// 本函数永不因显式失败而返回错误：水印是增强能力，不能阻断上传。
// 真正的错误只在输入完全无法识别时返回。
func Process(data []byte, contentType string) Result {
	res := Result{Data: data, ContentType: contentType, Ext: extFromMime(contentType)}

	cfg := LoadConfig()
	if !cfg.Enabled || len(data) == 0 {
		res.Skipped = true
		return res
	}

	kind, ext := sniffMedia(data, contentType)
	res.Media = kind
	if ext != "" {
		res.Ext = ext
	}
	if kind == "unknown" {
		res.Skipped = true
		return res
	}

	// 已经打过标识的文件直接跳过，保证补打任务可重复执行而不叠加角标
	if HasMark(data) {
		res.Implicit = true
		res.Ext = ext
		return res
	}

	out := data

	// ① 显式标识
	if cfg.Explicit {
		switch kind {
		case "image":
			if isGIF(data) || isWebP(data) {
				// 动图重编码会掉帧/丢动画，WebP Go 标准库无法编码，只做隐式
				res.ExplicitErr = fmt.Errorf("动图/WebP 跳过显式水印")
			} else {
				if b, err := drawBadge(out, contentType, cfg); err != nil {
					res.ExplicitErr = err
				} else {
					out = b
					res.Explicit = true
					res.Ext = ".png"
					if isJPEG(out) {
						res.Ext = ".jpg"
					}
				}
			}
		case "video":
			if b, err := burnVideoBadge(context.Background(), out, cfg); err != nil {
				res.ExplicitErr = err
			} else {
				out = b
				res.Explicit = true
			}
		}
	}

	// ② 隐式标识
	if cfg.Implicit {
		var b []byte
		var err error
		switch kind {
		case "image":
			switch {
			case isPNG(out):
				b, err = writePNGMeta(out, cfg)
			case isJPEG(out):
				b, err = writeJPEGMeta(out, cfg)
			default:
				err = fmt.Errorf("该图片格式暂不支持写入元数据")
			}
		case "video":
			b, err = writeMP4Meta(out, cfg)
		}
		if err != nil {
			res.ImplicitErr = err
		} else if b != nil {
			out = b
			res.Implicit = true
		}
	}

	res.Data = out
	res.ContentType = mimeFromExt(res.Ext, contentType)
	return res
}

// HasMark 检测文件是否已带本站生成标识。
// 用于补打任务的幂等判断——重复处理不会把角标越叠越花。
func HasMark(data []byte) bool {
	switch {
	case isPNG(data):
		return bytes.Contains(data, []byte("AI-Content-ID"))
	case isJPEG(data):
		return bytes.Contains(data, []byte(iptcDigitalSourceType)) ||
			bytes.Contains(data, []byte("AI-generated content"))
	case isMP4(data):
		return bytes.Contains(data, []byte(iptcDigitalSourceType))
	}
	return false
}

// 文件类型嗅探（以魔数为准，Content-Type 只作兜底，因为客户端常给错）

func isPNG(d []byte) bool { return len(d) > 8 && bytes.Equal(d[:8], pngSignature) }

func isJPEG(d []byte) bool { return len(d) > 3 && d[0] == 0xFF && d[1] == 0xD8 && d[2] == 0xFF }

func isWebP(d []byte) bool {
	return len(d) > 12 && string(d[:4]) == "RIFF" && string(d[8:12]) == "WEBP"
}

func isMP4(d []byte) bool {
	// 顶层第一个 box 一般是 ftyp；也见过以 free/skip 开头的
	if len(d) < 12 {
		return false
	}
	t := string(d[4:8])
	return t == "ftyp" || t == "moov" || t == "free" || t == "skip"
}

// sniffMedia 返回媒体大类与规范扩展名。
func sniffMedia(data []byte, contentType string) (kind, ext string) {
	switch {
	case isPNG(data):
		return "image", ".png"
	case isJPEG(data):
		return "image", ".jpg"
	case isGIF(data):
		return "image", ".gif"
	case isWebP(data):
		return "image", ".webp"
	case isMP4(data):
		return "video", ".mp4"
	}
	// 魔数不认识时退回 Content-Type
	switch {
	case strings.HasPrefix(contentType, "image/"):
		return "image", extFromMime(contentType)
	case strings.HasPrefix(contentType, "video/"):
		return "video", extFromMime(contentType)
	}
	return "unknown", ""
}

func extFromMime(ct string) string {
	switch {
	case strings.Contains(ct, "jpeg"), strings.Contains(ct, "jpg"):
		return ".jpg"
	case strings.Contains(ct, "png"):
		return ".png"
	case strings.Contains(ct, "gif"):
		return ".gif"
	case strings.Contains(ct, "webp"):
		return ".webp"
	case strings.Contains(ct, "mp4"):
		return ".mp4"
	case strings.Contains(ct, "quicktime"):
		return ".mov"
	case strings.Contains(ct, "webm"):
		return ".webm"
	case strings.HasPrefix(ct, "video/"):
		return ".mp4"
	default:
		return ".png"
	}
}

func mimeFromExt(ext, fallback string) string {
	switch ext {
	case ".png":
		return "image/png"
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".gif":
		return "image/gif"
	case ".webp":
		return "image/webp"
	case ".mp4":
		return "video/mp4"
	case ".mov":
		return "video/quicktime"
	case ".webm":
		return "video/webm"
	}
	return fallback
}

// contentID 生成内容编号：日期 + 16 位随机十六进制，便于按批次回溯。
func contentID() string {
	var b [8]byte
	if _, err := rand.Read(b[:]); err != nil {
		return fmt.Sprintf("ai-%d", time.Now().UnixNano())
	}
	return "ai-" + time.Now().Format("20060102") + "-" + hex.EncodeToString(b[:])
}

// ProcessAndLog 是给业务层用的便捷入口：处理并记录降级原因。
func ProcessAndLog(data []byte, contentType, scene string) Result {
	res := Process(data, contentType)
	if res.ExplicitErr != nil && !res.Skipped {
		common.SysError(fmt.Sprintf("[watermark] %s 显式水印降级: %v", scene, res.ExplicitErr))
	}
	if res.ImplicitErr != nil && !res.Skipped {
		common.SysError(fmt.Sprintf("[watermark] %s 隐式水印失败: %v", scene, res.ImplicitErr))
	}
	return res
}
