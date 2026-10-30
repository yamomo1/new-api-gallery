package controller

import (
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/service/storage"
	"github.com/QuantumNous/new-api/service/watermark"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// 上传体积上限。视频单列一档，因为一条 10 秒的成片轻松超过 10MB。
//
// 视频上限压到 100MB 是有意为之：水印处理需要把整个文件读进内存，
// 再叠加并发上传，200MB 的上限在中等配置机器上会打出 OOM。
const (
	maxImageUploadBytes = 15 << 20  // 15MB
	maxVideoUploadBytes = 100 << 20 // 100MB
)

// StorageUpload 全站通用媒体上传接口：
// 接收 multipart 表单字段 "file"，校验为图片/视频后先施加生成内容标识（水印），
// 再交给当前存储后端，返回可访问 URL。
//
// 权限：任意已登录用户（画廊投稿、头像、画布素材等通用）。
func StorageUpload(c *gin.Context) {
	fileHeader, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "缺少上传文件"})
		return
	}
	// 先按较大的上限拦一道，避免把超大文件读进内存
	if fileHeader.Size > maxVideoUploadBytes {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": fmt.Sprintf("文件过大，上限 %dMB", maxVideoUploadBytes>>20),
		})
		return
	}

	f, err := fileHeader.Open()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "无法读取上传文件"})
		return
	}
	defer f.Close()
	data, err := io.ReadAll(f)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "无法读取上传文件"})
		return
	}

	ct := fileHeader.Header.Get("Content-Type")
	detected := http.DetectContentType(data)
	isImage := strings.HasPrefix(ct, "image/") || strings.HasPrefix(detected, "image/")
	isVideo := strings.HasPrefix(ct, "video/") || strings.HasPrefix(detected, "video/")

	if !isImage && !isVideo {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "仅允许上传图片或视频"})
		return
	}
	if isImage && len(data) > maxImageUploadBytes {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": fmt.Sprintf("图片过大，上限 %dMB", maxImageUploadBytes>>20),
		})
		return
	}
	if ct == "" || ct == "application/octet-stream" {
		ct = detected
	}

	// 施加生成内容标识。显式角标失败会自动降级（例如视频没装 ffmpeg），
	// 隐式元数据仍会写入，绝不因为水印失败而阻断上传。
	res := watermark.ProcessAndLog(data, ct, "storage-upload")
	payload := res.Data
	contentType := res.ContentType
	ext := res.Ext
	if ext == "" {
		ext = extFromContentType(contentType)
	}

	key := fmt.Sprintf("uploads/%s/%s%s", time.Now().Format("20060102"), uuid.NewString(), ext)

	provider, err := storage.Get()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "存储后端未配置"})
		return
	}
	url, err := provider.Upload(key, contentType, payload)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "上传失败：" + err.Error()})
		return
	}

	// 海外镜像双写：开通后异步写入，失败仅记日志，不影响主流程。
	// 前端按用户地域决定展示国内还是海外地址，两边内容一致。
	if overseas, ok := storage.GetOverseas(); ok {
		go func(k, cType string, body []byte) {
			if _, err := overseas.Upload(k, cType, body); err != nil {
				common.SysError("[storage] 海外镜像上传失败 key=" + k + ": " + err.Error())
			}
		}(key, contentType, payload)
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    url,
		"key":     key,
		"media":   res.Media,
		// 水印状态回传前端，便于投稿页给出「已添加 AI 标识」的提示
		"watermark": gin.H{
			"explicit": res.Explicit,
			"implicit": res.Implicit,
		},
	})
}

// StorageConfig 公开端点：返回双存储的公开访问基址（不含任何密钥），
// 前端据此按用户地域把图片 key 解析成国内/海外 URL。
func StorageConfig(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"success": true, "data": storage.GetPublicConfig()})
}

// extFromContentType 把 image/* 或 video/* 映射成文件后缀（用于生成 key 的扩展名）。
func extFromContentType(ct string) string {
	switch {
	case strings.Contains(ct, "jpeg"):
		return ".jpg"
	case strings.Contains(ct, "png"):
		return ".png"
	case strings.Contains(ct, "gif"):
		return ".gif"
	case strings.Contains(ct, "webp"):
		return ".webp"
	case strings.Contains(ct, "bmp"):
		return ".bmp"
	case strings.Contains(ct, "svg"):
		return ".svg"
	case strings.Contains(ct, "mp4"):
		return ".mp4"
	case strings.Contains(ct, "quicktime"):
		return ".mov"
	case strings.Contains(ct, "webm"):
		return ".webm"
	default:
		return ".png"
	}
}
