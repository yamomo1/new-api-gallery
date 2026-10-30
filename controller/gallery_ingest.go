package controller

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service/galleryingest"

	"github.com/gin-gonic/gin"
)

// GalleryIngestStats 采集队列概览
func GalleryIngestStats(c *gin.Context) {
	stats, err := model.GetGalleryIngestStats()
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": stats})
}

// ListGalleryIngestJobs 采集任务列表
func ListGalleryIngestJobs(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	status := strings.TrimSpace(c.Query("status"))
	jobs, total, err := model.ListGalleryIngestJobs(status, (page-1)*pageSize, pageSize)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{
		"items":     jobs,
		"total":     total,
		"page":      page,
		"page_size": pageSize,
	}})
}

type ingestSeedItem struct {
	Title         string                       `json:"title"`
	Prompt        string                       `json:"prompt"`
	PromptEn      string                       `json:"prompt_en"`
	Model         string                       `json:"model"`
	Type          string                       `json:"type"`
	Category      string                       `json:"category"`
	Tags          string                       `json:"tags"`
	Size          string                       `json:"size"`
	WorkflowId    string                       `json:"workflow_id"`
	NodeOverrides []galleryingest.NodeOverride `json:"node_overrides"`
}

// CreateGalleryIngestSeeds 批量导入提示词种子
//
// 请求体：{"provider":"runninghub","items":[{prompt, prompt_en, model, type, category, tags, ...}]}
// 导入后任务处于 pending，等调度器（或手动 /run）提交给上游。
func CreateGalleryIngestSeeds(c *gin.Context) {
	var req struct {
		Provider string           `json:"provider"`
		Items    []ingestSeedItem `json:"items"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "请求体格式错误: " + err.Error()})
		return
	}
	provider := strings.TrimSpace(req.Provider)
	if provider == "" {
		provider = "runninghub"
	}
	if _, err := galleryingest.GetProvider(provider); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}
	if len(req.Items) == 0 {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "items 不能为空"})
		return
	}
	if len(req.Items) > 500 {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "单次最多导入 500 条"})
		return
	}

	jobs := make([]model.GalleryIngestJob, 0, len(req.Items))
	skipped := 0
	for _, it := range req.Items {
		prompt := strings.TrimSpace(it.Prompt)
		if prompt == "" {
			skipped++
			continue
		}
		job := model.GalleryIngestJob{
			Provider: provider,
			Prompt:   prompt,
			PromptEn: strings.TrimSpace(it.PromptEn),
			Model:    strings.TrimSpace(it.Model),
			Type:     strings.TrimSpace(it.Type),
			Category: strings.TrimSpace(it.Category),
			Tags:     strings.TrimSpace(it.Tags),
			Size:     strings.TrimSpace(it.Size),
			Title:    strings.TrimSpace(it.Title),
			Status:   model.GalleryIngestStatusPending,
		}
		job.WorkflowId = strings.TrimSpace(it.WorkflowId)
		if len(it.NodeOverrides) > 0 {
			if b, err := common.Marshal(it.NodeOverrides); err == nil {
				job.NodeOverrides = string(b)
			}
		}
		if job.Type == "" {
			job.Type = "image"
		}
		jobs = append(jobs, job)
	}
	if err := model.CreateGalleryIngestJobs(jobs); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{
		"created": len(jobs),
		"skipped": skipped,
	}})
}

// RunGalleryIngestOnce 手动触发一轮采集（提交 + 轮询）
func RunGalleryIngestOnce(c *gin.Context) {
	galleryingest.RunOnce(c.Request.Context())
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "已执行一轮"})
}

// RetryGalleryIngestJob 重试单条失败任务
func RetryGalleryIngestJob(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "无效的任务 ID"})
		return
	}
	if err := model.RetryGalleryIngestJob(id); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

// DeleteGalleryIngestJob 删除采集任务记录
func DeleteGalleryIngestJob(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "无效的任务 ID"})
		return
	}
	if err := model.DeleteGalleryIngestJob(id); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}
