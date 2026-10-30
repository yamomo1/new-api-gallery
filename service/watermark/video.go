package watermark

import (
	"bytes"
	"context"
	"encoding/binary"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"
)

// 视频显式角标依赖 ffmpeg。它的存在性在进程内缓存一次，
// 避免每个上传都跑一次 exec.LookPath。
var (
	ffmpegOnce sync.Once
	ffmpegBin  string
)

// detectFFmpeg 返回可用的 ffmpeg 路径，找不到返回空串。
func detectFFmpeg(cfg Config) string {
	ffmpegOnce.Do(func() {
		if cfg.FFmpegPath != "" {
			if p, err := exec.LookPath(cfg.FFmpegPath); err == nil {
				ffmpegBin = p
				return
			}
			if _, err := os.Stat(cfg.FFmpegPath); err == nil {
				ffmpegBin = cfg.FFmpegPath
				return
			}
		}
		if p, err := exec.LookPath("ffmpeg"); err == nil {
			ffmpegBin = p
			return
		}
		for _, p := range []string{
			"/usr/bin/ffmpeg",
			"/usr/local/bin/ffmpeg",
			"/opt/homebrew/bin/ffmpeg",
			"C:/ffmpeg/bin/ffmpeg.exe",
		} {
			if _, err := os.Stat(p); err == nil {
				ffmpegBin = p
				return
			}
		}
	})
	return ffmpegBin
}

// FFmpegAvailable 供后台设置页展示能力状态。
func FFmpegAvailable() bool {
	return detectFFmpeg(LoadConfig()) != ""
}

// burnVideoBadge 用 ffmpeg 把角标烧进视频画面。
//
// 参数上刻意保守：只在时长与体积都不超限时才做，因为纯 CPU 转码很吃资源。
// 超限时调用方会退回「仅隐式元数据」，标识不会丢，只是从画面角标降级为文件内声明。
func burnVideoBadge(ctx context.Context, data []byte, cfg Config) ([]byte, error) {
	bin := detectFFmpeg(cfg)
	if bin == "" {
		return nil, fmt.Errorf("未安装 ffmpeg")
	}

	if cfg.VideoMaxBytes > 0 && int64(len(data)) > cfg.VideoMaxBytes {
		return nil, fmt.Errorf("视频 %.1fMB 超过烧角标上限 %dMB",
			float64(len(data))/(1<<20), cfg.VideoMaxBytes>>20)
	}
	if cfg.VideoMaxSec > 0 {
		if d := mp4Duration(data); d > 0 && d > time.Duration(cfg.VideoMaxSec)*time.Second {
			return nil, fmt.Errorf("视频时长 %s 超过烧角标上限 %ds",
				d.Round(time.Second), cfg.VideoMaxSec)
		}
	}

	pf := resolveFont(cfg)
	if pf == nil || strings.HasPrefix(pf.src, "embedded:") {
		// drawtext 需要一个真实字体文件路径，内嵌字体用不了
		return nil, fmt.Errorf("视频角标需要磁盘字体文件，当前仅有内嵌字体")
	}
	fontFile := fontFileForFFmpeg(pf.src, cfg)

	text := pickText(pf, cfg)

	tmpDir, err := os.MkdirTemp("", "wm-video-*")
	if err != nil {
		return nil, err
	}
	defer os.RemoveAll(tmpDir)

	inPath := filepath.Join(tmpDir, "in.mp4")
	outPath := filepath.Join(tmpDir, "out.mp4")
	textPath := filepath.Join(tmpDir, "text.txt")

	if err := os.WriteFile(inPath, data, 0o600); err != nil {
		return nil, err
	}
	// drawtext 用 textfile 读文案，避免冒号/单引号等字符的转义地狱
	if err := os.WriteFile(textPath, []byte(text), 0o600); err != nil {
		return nil, err
	}

	runCtx, cancel := context.WithTimeout(ctx, 150*time.Second)
	defer cancel()

	filter := drawTextFilter(cfg, fontFile, textPath)

	// 编码器按优先级尝试：Debian 的 ffmpeg 带 libx264（质量/体积更优），
	// 精简构建可能只有内置 mpeg4。逐个试，第一个成功即返回。
	encoders := [][]string{
		{"-c:v", "libx264", "-preset", "veryfast", "-crf", "24"},
		{"-c:v", "mpeg4", "-q:v", "4"},
	}

	var lastErr error
	for _, enc := range encoders {
		args := []string{
			"-hide_banner", "-loglevel", "error", "-y",
			"-i", inPath,
			"-vf", filter,
		}
		args = append(args, enc...)
		args = append(args,
			"-pix_fmt", "yuv420p",
			"-c:a", "copy",
			"-movflags", "+faststart",
			outPath,
		)

		cmd := exec.CommandContext(runCtx, bin, args...)
		var stderr bytes.Buffer
		cmd.Stderr = &stderr
		if err := cmd.Run(); err != nil {
			msg := strings.TrimSpace(stderr.String())
			if len(msg) > 300 {
				msg = msg[:300]
			}
			if runCtx.Err() == context.DeadlineExceeded {
				return nil, fmt.Errorf("ffmpeg 超时")
			}
			lastErr = fmt.Errorf("%s: %s", enc[1], msg)
			continue
		}

		out, err := os.ReadFile(outPath)
		if err != nil {
			return nil, err
		}
		if len(out) == 0 {
			lastErr = fmt.Errorf("%s 输出为空", enc[1])
			continue
		}
		return out, nil
	}
	return nil, fmt.Errorf("ffmpeg 编码失败: %v", lastErr)
}

// fontFileForFFmpeg 为 drawtext 选出可用的字体文件路径。
// 自定义字体是 TTF 时直接用它；TTC 集合会让 libfreetype 取默认 face，
// 一般可用，但更稳的是先找同目录下的单体 TTF。
func fontFileForFFmpeg(src string, cfg Config) string {
	if !strings.HasSuffix(strings.ToLower(src), ".ttc") {
		return src
	}
	// TTC：让 ffmpeg 用 fontconfig 按家族名解析，比直接喂 ttc 更可靠
	return src // drawtext 的 fontfile 支持 ttc，取第 0 个 face
}

// drawTextFilter 组装 drawtext 滤镜串。
func drawTextFilter(cfg Config, fontFile, textPath string) string {
	shortestRef := "min(iw,ih)"
	size := fmt.Sprintf("max(11\\,min(180\\,%s/%d))", shortestRef, cfg.FontScale)
	margin := fmt.Sprintf("%s/40", shortestRef)

	// 位置表达式：x/y 分别对应文字的左上角
	var x, y string
	switch cfg.Position {
	case PosTopLeft:
		x, y = margin, margin
	case PosTopRight:
		x, y = "w-tw-"+margin, margin
	case PosBottomLeft:
		x, y = margin, "h-th-"+margin
	case PosCenter:
		x, y = "(w-tw)/2", "(h-th)/2"
	default:
		x, y = "w-tw-"+margin, "h-th-"+margin
	}

	alpha := strconv.FormatFloat(float64(cfg.Opacity)/100, 'f', 2, 64)
	col := ffColor(cfg.Color, alpha)

	parts := []string{
		"drawtext=fontfile='" + escapeFilterPath(fontFile) + "'",
		"textfile='" + escapeFilterPath(textPath) + "'",
		"fontcolor=" + col,
		"fontsize=" + size,
		"x=" + x,
		"y=" + y,
	}
	if cfg.BgEnabled {
		bgAlpha := strconv.FormatFloat(float64(cfg.Opacity)/100*0.42, 'f', 2, 64)
		bg := "black"
		if !isLightColor(cfg.Color) {
			bg = "white"
			bgAlpha = strconv.FormatFloat(float64(cfg.Opacity)/100*0.55, 'f', 2, 64)
		}
		parts = append(parts,
			"box=1",
			"boxcolor="+bg+"@"+bgAlpha,
			"boxborderw=6",
		)
	}
	return strings.Join(parts, ":")
}

// ffColor 把 #RRGGBB 转成 ffmpeg 的 0xRRGGBB@alpha 形式。
func ffColor(hex, alpha string) string {
	h := strings.TrimPrefix(strings.TrimSpace(hex), "#")
	if len(h) == 3 {
		h = string([]byte{h[0], h[0], h[1], h[1], h[2], h[2]})
	}
	if len(h) != 6 {
		h = "FFFFFF"
	}
	return "0x" + strings.ToUpper(h) + "@" + alpha
}

// escapeFilterPath 处理 filtergraph 里路径中的特殊字符。
func escapeFilterPath(p string) string {
	p = strings.ReplaceAll(p, `\`, `/`)
	p = strings.ReplaceAll(p, `:`, `\:`)
	p = strings.ReplaceAll(p, `'`, `\'`)
	return p
}

// mp4Duration 从 moov/mvhd 读视频时长，避免为此再依赖一个 ffprobe。
// 解析失败返回 0，调用方按「未知时长」放行。
func mp4Duration(data []byte) time.Duration {
	boxes, err := parseMP4Boxes(data)
	if err != nil {
		return 0
	}
	for _, b := range boxes {
		if b.typ != "moov" {
			continue
		}
		moovEnd := b.offset + b.totalSize
		if moovEnd > len(data) {
			return 0
		}
		// 在 moov 内顺序找 mvhd
		p := b.offset + b.headerSize
		for p+8 <= moovEnd {
			size := int(binary.BigEndian.Uint32(data[p : p+4]))
			typ := string(data[p+4 : p+8])
			if size < 8 || p+size > moovEnd {
				break
			}
			if typ == "mvhd" {
				body := data[p+8 : p+size]
				if len(body) < 4 {
					return 0
				}
				version := body[0]
				if version == 1 {
					if len(body) < 32 {
						return 0
					}
					timescale := binary.BigEndian.Uint32(body[20:24])
					duration := binary.BigEndian.Uint64(body[24:32])
					if timescale == 0 {
						return 0
					}
					return time.Duration(float64(duration) / float64(timescale) * float64(time.Second))
				}
				if len(body) < 20 {
					return 0
				}
				timescale := binary.BigEndian.Uint32(body[12:16])
				duration := binary.BigEndian.Uint32(body[16:20])
				if timescale == 0 {
					return 0
				}
				return time.Duration(float64(duration) / float64(timescale) * float64(time.Second))
			}
			p += size
		}
	}
	return 0
}

// FFmpegBinary 返回探测到的 ffmpeg 路径，未安装时为空串。
func FFmpegBinary() string {
	return detectFFmpeg(LoadConfig())
}
