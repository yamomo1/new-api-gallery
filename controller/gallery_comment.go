package controller

import (
	"net/http"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

// GetGalleryComments 作品评论列表（公开）
// GET /api/prompt-gallery/v1/prompts/:id/comments?offset=0&limit=20
func GetGalleryComments(c *gin.Context) {
	galleryId, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || galleryId <= 0 {
		common.ApiErrorT(c, "Invalid gallery id")
		return
	}
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	sort := c.DefaultQuery("sort", "latest")

	items, total, err := model.ListGalleryComments(galleryId, offset, limit, sort)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	// 认证标签批量取；is_mine 交给前端判断能否显示删除
	userIds := make([]int, 0, len(items))
	for _, item := range items {
		if item.UserId > 0 {
			userIds = append(userIds, item.UserId)
		}
	}
	badges := model.GetUserGalleryBadges(userIds)
	currentUserId := c.GetInt("id")
	isAdmin := c.GetInt("role") >= common.RoleAdminUser
	for i := range items {
		items[i].Badge = badges[items[i].UserId]
		items[i].IsMine = currentUserId > 0 && (isAdmin || items[i].UserId == currentUserId)
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"items": items,
			"total": total,
		},
	})
}

// CreateGalleryComment 发表评论（登录用户）
// POST /api/prompt-gallery/v1/prompts/:id/comments  body: { "content": "..." }
func CreateGalleryComment(c *gin.Context) {
	userId := c.GetInt("id")
	if userId <= 0 {
		common.ApiErrorMsg(c, "请先登录")
		return
	}
	galleryId, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || galleryId <= 0 {
		common.ApiErrorT(c, "Invalid gallery id")
		return
	}
	var req struct {
		Content string `json:"content"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorT(c, "Invalid request")
		return
	}
	item, err := model.CreateGalleryComment(userId, galleryId, req.Content)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": item})
}

// DeleteGalleryComment 删除评论（本人或管理员）
// DELETE /api/prompt-gallery/v1/comments/:id
func DeleteGalleryComment(c *gin.Context) {
	userId := c.GetInt("id")
	if userId <= 0 {
		common.ApiErrorMsg(c, "请先登录")
		return
	}
	commentId, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || commentId <= 0 {
		common.ApiErrorT(c, "Invalid comment id")
		return
	}
	isAdmin := c.GetInt("role") >= common.RoleAdminUser
	if err := model.DeleteGalleryComment(commentId, userId, isAdmin); err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

// LikeGalleryComment 评论点赞（公开，前端 localStorage 防重复）
// POST /api/prompt-gallery/v1/comments/:id/like
func LikeGalleryComment(c *gin.Context) {
	commentId, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || commentId <= 0 {
		common.ApiErrorT(c, "Invalid comment id")
		return
	}
	likes, err := model.LikeGalleryComment(commentId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"likes": likes}})
}
