package controller

import (
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/service/storage"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

const maxStorageUploadBytes = 10 << 20 // 10MB

// StorageUpload 全站通用图片上传接口：
// 接收 multipart 表单字段 "file"，校验为图片后交给当前存储后端，返回可访问 URL。
// 权限：任意已登录用户（画廊封面、头像、画布素材等通用）。
func StorageUpload(c *gin.Context) {
	fileHeader, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "缺少上传文件"})
		return
	}
	if fileHeader.Size > maxStorageUploadBytes {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": fmt.Sprintf("文件过大，上限 %dMB", maxStorageUploadBytes>>20),
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
	if !strings.HasPrefix(ct, "image/") {
		ct = http.DetectContentType(data)
	}
	if !strings.HasPrefix(ct, "image/") {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "仅允许上传图片"})
		return
	}

	ext := extFromContentType(ct)
	key := fmt.Sprintf("uploads/%s/%s%s", time.Now().Format("20060102"), uuid.NewString(), ext)

	provider, err := storage.Get()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "存储后端未配置"})
		return
	}
	url, err := provider.Upload(key, ct, data)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "上传失败：" + err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": url})
}

// extFromContentType 把 image/* 映射成文件后缀（用于生成 key 的扩展名）。
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
	default:
		return ".png"
	}
}
