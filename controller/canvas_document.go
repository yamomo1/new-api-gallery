package controller

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

// ListMyCanvasDocuments 我的画布列表（不含图数据体）
// GET /api/canvas/v1/documents
func ListMyCanvasDocuments(c *gin.Context) {
	userId := c.GetInt("id")
	items, err := model.ListCanvasDocuments(userId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": items})
}

// CreateMyCanvasDocument 新建画布
// POST /api/canvas/v1/documents  body: {title?, graph?, description?, visibility?, thumbnail?}
func CreateMyCanvasDocument(c *gin.Context) {
	userId := c.GetInt("id")
	username := c.GetString("username")
	var req struct {
		Title      string `json:"title"`
		Graph      string `json:"graph"`
		Description string `json:"description"`
		Visibility  string `json:"visibility"`
		Thumbnail   string `json:"thumbnail"`
	}
	_ = c.ShouldBindJSON(&req)
	item := &model.CanvasDocument{
		UserId:      userId,
		Title:       req.Title,
		Graph:       req.Graph,
		Description: req.Description,
		Visibility:  strings.TrimSpace(req.Visibility),
		Thumbnail:   req.Thumbnail,
		Author:      username,
	}
	if err := model.CreateCanvasDocument(item); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccessT(c, "Canvas created", item)
}

// GetMyCanvasDocument 取单张画布（含图数据，仅本人）
// GET /api/canvas/v1/documents/:id
func GetMyCanvasDocument(c *gin.Context) {
	userId := c.GetInt("id")
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		common.ApiErrorT(c, "Invalid canvas id")
		return
	}
	item, err := model.GetCanvasDocument(userId, id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": item})
}

// UpdateMyCanvasDocument 保存画布（任一字段可空）
// PUT /api/canvas/v1/documents/:id  body: {title?, graph?, description?, visibility?, thumbnail?}
func UpdateMyCanvasDocument(c *gin.Context) {
	userId := c.GetInt("id")
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		common.ApiErrorT(c, "Invalid canvas id")
		return
	}
	var req struct {
		Title      string `json:"title"`
		Graph      string `json:"graph"`
		Description string `json:"description"`
		Visibility  string `json:"visibility"`
		Thumbnail   string `json:"thumbnail"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorT(c, "Invalid request body")
		return
	}
	upd := map[string]any{}
	if t := strings.TrimSpace(req.Title); t != "" {
		upd["title"] = t
	}
	if req.Graph != "" {
		upd["graph"] = req.Graph
	}
	if req.Description != "" {
		upd["description"] = req.Description
	}
	if v := strings.TrimSpace(req.Visibility); v != "" {
		upd["visibility"] = v
	}
	if req.Thumbnail != "" {
		upd["thumbnail"] = req.Thumbnail
	}
	if err := model.UpdateCanvasDocument(userId, id, upd); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccessT(c, "Canvas saved", nil)
}

// DeleteMyCanvasDocument 删除画布（仅本人）
// DELETE /api/canvas/v1/documents/:id
func DeleteMyCanvasDocument(c *gin.Context) {
	userId := c.GetInt("id")
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		common.ApiErrorT(c, "Invalid canvas id")
		return
	}
	if err := model.DeleteCanvasDocument(userId, id); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccessT(c, "Canvas deleted", nil)
}

// ListPublicCanvasDocuments 公开画廊列表（免登录）
// GET /api/canvas/v1/gallery?offset=&limit=
func ListPublicCanvasDocuments(c *gin.Context) {
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "24"))
	if limit <= 0 || limit > 100 {
		limit = 24
	}
	items, total, err := model.ListPublicCanvasDocuments(offset, limit)
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

// GetPublicCanvasDocument 取公开画布（仅 visibility=public，含完整 graph 供前端打开）
// GET /api/canvas/v1/gallery/:id
func GetPublicCanvasDocument(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		common.ApiErrorT(c, "Invalid canvas id")
		return
	}
	item, err := model.GetPublicCanvasDocument(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": item})
}
