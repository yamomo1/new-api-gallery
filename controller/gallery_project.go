package controller

import (
	"net/http"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

// ListMyGalleryProjects 我的项目/文件夹列表
// GET /api/prompt-gallery/v1/projects
func ListMyGalleryProjects(c *gin.Context) {
	userId := c.GetInt("id")
	items, err := model.ListGalleryProjects(userId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": items})
}

// CreateMyGalleryProject 新建项目/文件夹
// POST /api/prompt-gallery/v1/projects  body: {name, kind}
func CreateMyGalleryProject(c *gin.Context) {
	userId := c.GetInt("id")
	var req struct {
		Name string `json:"name"`
		Kind string `json:"kind"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorT(c, "Invalid request body")
		return
	}
	item := &model.GalleryProject{
		UserId: userId,
		Name:   req.Name,
		Kind:   req.Kind,
	}
	if err := model.CreateGalleryProject(item); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccessT(c, "Project created", item)
}

// UpdateMyGalleryProject 重命名
// PUT /api/prompt-gallery/v1/projects/:id  body: {name}
func UpdateMyGalleryProject(c *gin.Context) {
	userId := c.GetInt("id")
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		common.ApiErrorT(c, "Invalid project id")
		return
	}
	var req struct {
		Name string `json:"name"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorT(c, "Invalid request body")
		return
	}
	if err := model.UpdateGalleryProject(userId, id, req.Name); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccessT(c, "Project updated", nil)
}

// DeleteMyGalleryProject 删除（组内作品移出为未分组）
// DELETE /api/prompt-gallery/v1/projects/:id
func DeleteMyGalleryProject(c *gin.Context) {
	userId := c.GetInt("id")
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		common.ApiErrorT(c, "Invalid project id")
		return
	}
	if err := model.DeleteGalleryProject(userId, id); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccessT(c, "Project deleted", nil)
}

// GetMyPromptGalleries 我的作品列表（登录态，支持工作台筛选）
// GET /api/prompt-gallery/v1/mine?project_id=&type=&search=&sort=&offset=&limit=
// project_id=-1 不过滤；project_id=none 只看未分组
func GetMyPromptGalleries(c *gin.Context) {
	userId := c.GetInt("id")
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "60"))
	if limit <= 0 || limit > 100 {
		limit = 60
	}
	q := model.MyGalleryQuery{
		Type:   c.Query("type"),
		Search: c.Query("search"),
		Sort:   c.DefaultQuery("sort", "latest"),
	}
	if pid := c.Query("project_id"); pid != "" {
		if pid == "none" {
			q.ProjectNone = true
			q.ProjectId = -1
		} else if v, err := strconv.ParseInt(pid, 10, 64); err == nil && v >= 0 {
			q.ProjectId = v
		} else {
			q.ProjectId = -1
		}
	} else {
		q.ProjectId = -1
	}
	items, total, err := model.GetUserPromptGalleries(userId, q, offset, limit)
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

// SetMyPromptGalleryProject 移动作品到项目/文件夹（不动审核状态）
// POST /api/prompt-gallery/v1/mine/:id/project  body: {project_id}
func SetMyPromptGalleryProject(c *gin.Context) {
	userId := c.GetInt("id")
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		common.ApiErrorT(c, "Invalid gallery id")
		return
	}
	var req struct {
		ProjectId int64 `json:"project_id"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorT(c, "Invalid request body")
		return
	}
	if req.ProjectId != 0 {
		var p model.GalleryProject
		if err := model.DB.Where("id = ? AND user_id = ?", req.ProjectId, userId).First(&p).Error; err != nil {
			common.ApiErrorT(c, "Project not found")
			return
		}
	}
	if err := model.SetPromptGalleryProject(userId, id, req.ProjectId); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccessT(c, "Gallery item moved", nil)
}
