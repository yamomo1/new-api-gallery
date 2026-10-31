package model

import (
	"errors"
	"strings"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

// MaxGalleryCommentLength 单条评论字数上限（按 rune 计，中文按字算）
const MaxGalleryCommentLength = 500

// GalleryComment 作品评论。
// 只做平铺（不做楼中楼）：作品页的评论量级用不到树形结构，
// 展示顺序按时间倒序，最新的在最上面。
type GalleryComment struct {
	Id        int64 `json:"id" gorm:"primaryKey;autoIncrement"`
	GalleryId int64 `json:"gallery_id" gorm:"index:idx_gallery_comment_gallery"`
	UserId    int   `json:"user_id" gorm:"index"`
	// Username 冗余存发布时的显示名：列表不联表，改名后旧评论保留当时昵称
	Username  string `json:"username" gorm:"type:varchar(64)"`
	Content   string `json:"content" gorm:"type:varchar(500)"`
	CreatedAt int64  `json:"created_at" gorm:"bigint;index"`
	Likes     int    `json:"likes" gorm:"not null;default:0"`

	// Badge 作者认证标签（现查 users.gallery_badge，不落库）
	Badge string `json:"badge" gorm:"-"`
	// IsMine 当前请求者能否删除（本人或管理员）
	IsMine bool `json:"is_mine" gorm:"-"`
}

func (GalleryComment) TableName() string {
	return "gallery_comments"
}

// CountGalleryComments 某作品的评论总数
func CountGalleryComments(galleryId int64) int64 {
	if DB == nil || galleryId <= 0 {
		return 0
	}
	var total int64
	DB.Model(&GalleryComment{}).Where("gallery_id = ?", galleryId).Count(&total)
	return total
}

// ListGalleryComments 分页取评论；sort=popular 按点赞，其余按最新
func ListGalleryComments(galleryId int64, offset, limit int, sort string) ([]GalleryComment, int64, error) {
	if DB == nil || galleryId <= 0 {
		return nil, 0, nil
	}
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}
	var total int64
	if err := DB.Model(&GalleryComment{}).Where("gallery_id = ?", galleryId).Count(&total).Error; err != nil {
		return nil, 0, err
	}
	order := "id DESC"
	if sort == "popular" {
		order = "likes DESC, id DESC"
	}
	var items []GalleryComment
	err := DB.Where("gallery_id = ?", galleryId).
		Order(order).
		Offset(offset).
		Limit(limit).
		Find(&items).Error
	return items, total, err
}

// CreateGalleryComment 发表评论；空内容与超长在这里兜底（前端也会校验）
func CreateGalleryComment(userId int, galleryId int64, content string) (*GalleryComment, error) {
	if userId <= 0 {
		return nil, errors.New("请先登录")
	}
	if galleryId <= 0 {
		return nil, errors.New("作品不存在")
	}
	content = strings.TrimSpace(content)
	if content == "" {
		return nil, errors.New("评论内容不能为空")
	}
	if utf8.RuneCountInString(content) > MaxGalleryCommentLength {
		return nil, errors.New("评论最多 500 字")
	}
	// 只允许评论已发布作品
	if _, err := GetPromptGalleryById(galleryId); err != nil {
		return nil, errors.New("作品不存在或已下架")
	}
	user, err := GetUserById(userId, false)
	if err != nil {
		return nil, err
	}
	name := user.DisplayName
	if strings.TrimSpace(name) == "" {
		name = user.Username
	}
	item := GalleryComment{
		GalleryId: galleryId,
		UserId:    userId,
		Username:  name,
		Content:   content,
		CreatedAt: common.GetTimestamp(),
	}
	if err := DB.Create(&item).Error; err != nil {
		return nil, err
	}
	item.Badge = user.GalleryBadge
	item.IsMine = true
	return &item, nil
}

// DeleteGalleryComment 删除评论：本人或管理员
func DeleteGalleryComment(commentId int64, userId int, isAdmin bool) error {
	if DB == nil || commentId <= 0 {
		return gorm.ErrRecordNotFound
	}
	var item GalleryComment
	if err := DB.Where("id = ?", commentId).First(&item).Error; err != nil {
		return err
	}
	if !isAdmin && item.UserId != userId {
		return errors.New("只能删除自己的评论")
	}
	return DB.Where("id = ?", commentId).Delete(&GalleryComment{}).Error
}

// GetUserGalleryBadges 批量取用户认证标签，避免评论列表 N+1
func GetUserGalleryBadges(userIds []int) map[int]string {
	result := make(map[int]string, len(userIds))
	if DB == nil || len(userIds) == 0 {
		return result
	}
	type row struct {
		Id           int
		GalleryBadge string
	}
	var rows []row
	DB.Model(&User{}).
		Select("id", "gallery_badge").
		Where("id IN ?", userIds).
		Find(&rows)
	for _, r := range rows {
		result[r.Id] = r.GalleryBadge
	}
	return result
}

// LikeGalleryComment 评论点赞 +1，返回最新点赞数（前端用 localStorage 防重复点击）
func LikeGalleryComment(commentId int64) (int, error) {
	if DB == nil || commentId <= 0 {
		return 0, gorm.ErrRecordNotFound
	}
	result := DB.Model(&GalleryComment{}).
		Where("id = ?", commentId).
		Update("likes", gorm.Expr("likes + 1"))
	if result.Error != nil {
		return 0, result.Error
	}
	if result.RowsAffected == 0 {
		return 0, gorm.ErrRecordNotFound
	}
	var item GalleryComment
	if err := DB.Select("likes").Where("id = ?", commentId).First(&item).Error; err != nil {
		return 0, err
	}
	return item.Likes, nil
}
