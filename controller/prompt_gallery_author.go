package controller

import (
	"net/http"
	"strconv"
	"strings"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

// galleryBadgeMaxRunes 认证标签长度上限：作者卡空间有限，超长会撑破布局
const galleryBadgeMaxRunes = 16

// GetGalleryAuthor 作者卡数据：名称/认证/作品数/总浏览/总点赞/粉丝数/我是否已关注
// GET /api/prompt-gallery/v1/authors/:id
func GetGalleryAuthor(c *gin.Context) {
	authorId, err := strconv.Atoi(c.Param("id"))
	if err != nil || authorId <= 0 {
		common.ApiErrorT(c, "Invalid author id")
		return
	}
	// 未登录时 c.GetInt("id") = 0，Following 恒为 false
	stats, err := model.GetGalleryAuthorStats(authorId, c.GetInt("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": stats})
}

// ToggleGalleryAuthorFollow 关注 / 取关作者（登录用户）
// POST /api/prompt-gallery/v1/authors/:id/follow
func ToggleGalleryAuthorFollow(c *gin.Context) {
	userId := c.GetInt("id")
	if userId <= 0 {
		common.ApiErrorMsg(c, "请先登录")
		return
	}
	authorId, err := strconv.Atoi(c.Param("id"))
	if err != nil || authorId <= 0 {
		common.ApiErrorT(c, "Invalid author id")
		return
	}
	if authorId == userId {
		common.ApiErrorMsg(c, "不能关注自己")
		return
	}
	following, followers, err := model.ToggleGalleryAuthorFollow(userId, authorId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    gin.H{"following": following, "followers": followers},
	})
}

// AdminSetGalleryAuthorBadge 设置作者认证标签（空串 = 清除认证，前台回退「热心网友」）
// PUT /api/prompt-gallery/v1/admin/authors/:id/badge
func AdminSetGalleryAuthorBadge(c *gin.Context) {
	authorId, err := strconv.Atoi(c.Param("id"))
	if err != nil || authorId <= 0 {
		common.ApiErrorT(c, "Invalid author id")
		return
	}
	var req struct {
		Badge string `json:"badge"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	badge := strings.TrimSpace(req.Badge)
	if utf8.RuneCountInString(badge) > galleryBadgeMaxRunes {
		common.ApiErrorMsg(c, "认证标签最多 16 个字")
		return
	}
	if _, err := model.GetUserById(authorId, false); err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.SetGalleryAuthorBadge(authorId, badge); err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    gin.H{"gallery_badge": badge},
	})
}
