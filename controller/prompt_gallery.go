package controller

import (
	"net/http"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

// GetPromptGalleryList 公开画廊列表
// GET /api/prompt-gallery/v1/prompts
func GetPromptGalleryList(c *gin.Context) {
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	if limit <= 0 || limit > 100 {
		limit = 20
	}

	query := model.PromptGalleryListQuery{
		Category: c.Query("category"),
		Search:   c.Query("search"),
		Type:     c.Query("type"),
		Model:    c.Query("model"),
		Sort:     c.DefaultQuery("sort", "related"),
		Offset:   offset,
		Limit:    limit,
	}

	items, total, err := model.GetPublishedPromptGalleries(query)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"items":  items,
			"total":  total,
			"offset": offset,
			"limit":  limit,
		},
	})
}

// GetPromptGalleryDetail 公开画廊详情
// GET /api/prompt-gallery/v1/prompts/:id
func GetPromptGalleryDetail(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		common.ApiErrorT(c, "Invalid gallery id")
		return
	}
	item, err := model.GetPromptGalleryById(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	model.IncrPromptGalleryViews(id)
	c.JSON(http.StatusOK, gin.H{"success": true, "data": item})
}

// GetPromptGalleryFacets 聚合分类/模型/类型
// GET /api/prompt-gallery/v1/facets
func GetPromptGalleryFacets(c *gin.Context) {
	facets, err := model.GetPromptGalleryFacets()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": facets})
}

// GetMyPromptGalleries 我的作品列表（登录态）
// GET /api/prompt-gallery/v1/mine
func GetMyPromptGalleries(c *gin.Context) {
	userId := c.GetInt("id")
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	items, total, err := model.GetUserPromptGalleries(userId, offset, limit)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"items":  items,
			"total":  total,
			"offset": offset,
			"limit":  limit,
		},
	})
}

// CreateMyPromptGallery 发布作品
// POST /api/prompt-gallery/v1/mine
func CreateMyPromptGallery(c *gin.Context) {
	userId := c.GetInt("id")
	username := c.GetString("username")

	var req struct {
		Title    string `json:"title"`
		Prompt   string `json:"prompt"`
		Model    string `json:"model"`
		Type     string `json:"type"`
		Cover    string `json:"cover"`
		Media    string `json:"media"`
		Category string `json:"category"`
		Tags     string `json:"tags"`
	}
	if err := common.UnmarshalJsonStr(c.PostForm("json"), &req); err != nil {
		_ = c.ShouldBindJSON(&req)
	}
	if req.Title == "" || req.Prompt == "" {
		common.ApiErrorT(c, "Title and prompt are required")
		return
	}

	item := &model.PromptGallery{
		Title:    req.Title,
		Prompt:   req.Prompt,
		Model:    req.Model,
		Type:     req.Type,
		Cover:    req.Cover,
		Media:    req.Media,
		Category: req.Category,
		Tags:     req.Tags,
		AuthorId: userId,
		Author:   username,
	}
	if item.Type == "" {
		item.Type = "image"
	}
	if err := model.CreatePromptGallery(item); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccessT(c, "Gallery item submitted", item)
}

// UpdateMyPromptGallery 更新作品
// PUT /api/prompt-gallery/v1/mine/:id
func UpdateMyPromptGallery(c *gin.Context) {
	userId := c.GetInt("id")
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		common.ApiErrorT(c, "Invalid gallery id")
		return
	}
	var req struct {
		Title    string `json:"title"`
		Prompt   string `json:"prompt"`
		Model    string `json:"model"`
		Type     string `json:"type"`
		Cover    string `json:"cover"`
		Media    string `json:"media"`
		Category string `json:"category"`
		Tags     string `json:"tags"`
	}
	if err := common.UnmarshalJsonStr(c.PostForm("json"), &req); err != nil {
		_ = c.ShouldBindJSON(&req)
	}

	update := &model.PromptGallery{
		Title:    req.Title,
		Prompt:   req.Prompt,
		Model:    req.Model,
		Type:     req.Type,
		Cover:    req.Cover,
		Media:    req.Media,
		Category: req.Category,
		Tags:     req.Tags,
	}
	if err := model.UpdatePromptGallery(userId, id, update); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccessT(c, "Gallery item updated", nil)
}

// DeleteMyPromptGallery 删除作品
// DELETE /api/prompt-gallery/v1/mine/:id
func DeleteMyPromptGallery(c *gin.Context) {
	userId := c.GetInt("id")
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		common.ApiErrorT(c, "Invalid gallery id")
		return
	}
	if err := model.DeletePromptGallery(userId, id); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccessT(c, "Gallery item deleted", nil)
}

// AdminListPromptGalleries 管理员全量列表
// GET /api/prompt-gallery/v1/admin/prompts
func AdminListPromptGalleries(c *gin.Context) {
	status := c.DefaultQuery("status", "")
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	items, total, err := model.AdminListPromptGalleries(status, offset, limit)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"items":  items,
			"total":  total,
			"offset": offset,
			"limit":  limit,
		},
	})
}

// AdminSetPromptGalleryStatus 管理员审核（发布/驳回）
// POST /api/prompt-gallery/v1/admin/prompts/:id/status
func AdminSetPromptGalleryStatus(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		common.ApiErrorT(c, "Invalid gallery id")
		return
	}
	var req struct {
		Status string `json:"status"`
	}
	if err := common.UnmarshalJsonStr(c.PostForm("json"), &req); err != nil {
		_ = c.ShouldBindJSON(&req)
	}
	if err := model.AdminSetPromptGalleryStatus(id, req.Status); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccessT(c, "Gallery status updated", nil)
}
