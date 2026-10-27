package controller

import (
	"net/http"
	"strconv"

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
// POST /api/canvas/v1/documents  body: {title?, graph?}
func CreateMyCanvasDocument(c *gin.Context) {
	userId := c.GetInt("id")
	var req struct {
		Title string `json:"title"`
		Graph string `json:"graph"`
	}
	_ = c.ShouldBindJSON(&req)
	item := &model.CanvasDocument{
		UserId: userId,
		Title:  req.Title,
		Graph:  req.Graph,
	}
	if err := model.CreateCanvasDocument(item); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccessT(c, "Canvas created", item)
}

// GetMyCanvasDocument 取单张画布（含图数据）
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

// UpdateMyCanvasDocument 保存画布（标题 / 图数据，任一可空）
// PUT /api/canvas/v1/documents/:id  body: {title?, graph?}
func UpdateMyCanvasDocument(c *gin.Context) {
	userId := c.GetInt("id")
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		common.ApiErrorT(c, "Invalid canvas id")
		return
	}
	var req struct {
		Title string `json:"title"`
		Graph string `json:"graph"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorT(c, "Invalid request body")
		return
	}
	if err := model.UpdateCanvasDocument(userId, id, req.Title, req.Graph); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccessT(c, "Canvas saved", nil)
}

// DeleteMyCanvasDocument 删除画布
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
