package controller

import (
	"net/http"

	"github.com/QuantumNous/new-api/service/watermark"
	"github.com/gin-gonic/gin"
)

// GetWatermarkStatus 返回水印能力的实时状态，供后台设置页展示。
//
// 这里刻意不返回任何密钥类信息，只暴露「有没有 ffmpeg / 用的是哪个字体 /
// 各格式走哪条通道」这类运维事实，让管理员一眼看出角标是否会真的烧进视频。
func GetWatermarkStatus(c *gin.Context) {
	cfg := watermark.LoadConfig()

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"enabled":        cfg.Enabled,
			"explicit":       cfg.Explicit,
			"implicit":       cfg.Implicit,
			"ffmpeg_ready":   watermark.FFmpegAvailable(),
			"ffmpeg_bin":     watermark.FFmpegBinary(),
			"font_source":    watermark.FontSource(),
			"font_cjk_ready": watermark.FontSupportsChinese(),
			"image_formats":  []string{"png", "jpeg", "webp"},
			"video_formats":  []string{"mp4", "mov"},
			"notes": []string{
				"PNG：写入 iTXt/tEXt（UTF-8，支持中文）",
				"JPEG：写入 EXIF + XMP（IPTC DigitalSourceType 标准取值）",
				"MP4：moov 在尾部时写 udta，否则在文件末尾追加 XMP 扩展盒（不改动原有字节）",
				"GIF/WebP：动图重编码会掉帧，仅写隐式元数据，不烧角标",
			},
		},
	})
}

// StartWatermarkBackfill 触发存量文件补打标识。
// 请求体：{"limit": 50, "dry_run": true}
// 建议先用 dry_run 摸清影响面，再正式执行。
func StartWatermarkBackfill(c *gin.Context) {
	var req struct {
		Limit  int  `json:"limit"`
		DryRun bool `json:"dry_run"`
	}
	_ = c.ShouldBindJSON(&req)

	if err := watermark.StartBackfill(req.Limit, req.DryRun); err != nil {
		c.JSON(http.StatusConflict, gin.H{"success": false, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": watermark.BackfillStatus()})
}

// GetWatermarkBackfillStatus 查询补打任务进度。
func GetWatermarkBackfillStatus(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"success": true, "data": watermark.BackfillStatus()})
}
