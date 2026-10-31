package model

import (
	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// GalleryAuthorFollow 画廊作者关注关系（userId + authorId 唯一）
// ---------------------------------------------------------------
// 只服务详情页作者卡的「关注」按钮与作者统计，不参与鉴权，
// 因此不写缓存，直接读写 DB（量级小、可接受）。
type GalleryAuthorFollow struct {
	Id        int64 `json:"id" gorm:"primaryKey;autoIncrement"`
	UserId    int   `json:"user_id" gorm:"uniqueIndex:idx_gallery_follow_user_author;index"`
	AuthorId  int   `json:"author_id" gorm:"uniqueIndex:idx_gallery_follow_user_author;index"`
	CreatedAt int64 `json:"created_at" gorm:"bigint"`
}

func (GalleryAuthorFollow) TableName() string {
	return "gallery_author_follows"
}

// GalleryAuthorStats 作者卡所需的聚合数据
type GalleryAuthorStats struct {
	Id        int    `json:"id"`
	Name      string `json:"name"`
	Badge     string `json:"badge"`
	Works     int64  `json:"works"`
	Views     int64  `json:"views"`
	Likes     int64  `json:"likes"`
	Followers int64  `json:"followers"`
	Following bool   `json:"following"`
}

// ToggleGalleryAuthorFollow 关注 / 取关，返回 (toggle 后是否已关注, 粉丝总数)
func ToggleGalleryAuthorFollow(userId int, authorId int) (bool, int64, error) {
	if userId <= 0 || authorId <= 0 {
		return false, 0, gorm.ErrRecordNotFound
	}
	var existing GalleryAuthorFollow
	err := DB.Where("user_id = ? AND author_id = ?", userId, authorId).First(&existing).Error
	following := false
	switch {
	case err == nil:
		if err := DB.Where("id = ?", existing.Id).Delete(&GalleryAuthorFollow{}).Error; err != nil {
			return false, 0, err
		}
	case err == gorm.ErrRecordNotFound:
		row := GalleryAuthorFollow{UserId: userId, AuthorId: authorId, CreatedAt: common.GetTimestamp()}
		// 并发重复点击时 OnConflict 兜底，避免唯一索引报错
		if err := DB.Clauses(clause.OnConflict{DoNothing: true}).Create(&row).Error; err != nil {
			return false, 0, err
		}
		following = true
	default:
		return false, 0, err
	}
	return following, CountGalleryAuthorFollowers(authorId), nil
}

// IsGalleryAuthorFollowed 是否已关注（未登录恒为 false）
func IsGalleryAuthorFollowed(userId int, authorId int) bool {
	if userId <= 0 || authorId <= 0 {
		return false
	}
	var count int64
	DB.Model(&GalleryAuthorFollow{}).
		Where("user_id = ? AND author_id = ?", userId, authorId).
		Count(&count)
	return count > 0
}

// CountGalleryAuthorFollowers 作者粉丝数
func CountGalleryAuthorFollowers(authorId int) int64 {
	if authorId <= 0 {
		return 0
	}
	var count int64
	DB.Model(&GalleryAuthorFollow{}).Where("author_id = ?", authorId).Count(&count)
	return count
}

// SetGalleryAuthorBadge 设置作者认证标签（空串 = 清除认证）
// 作者名可能来自已删除账号，这里只更新存在的行，不报错。
func SetGalleryAuthorBadge(authorId int, badge string) error {
	return DB.Model(&User{}).Where("id = ?", authorId).Update("gallery_badge", badge).Error
}

// GetGalleryAuthorStats 作者统计：名称/认证/作品数/总浏览/总点赞/粉丝数/我是否已关注
func GetGalleryAuthorStats(authorId int, viewerId int) (*GalleryAuthorStats, error) {
	if authorId <= 0 {
		return nil, gorm.ErrRecordNotFound
	}

	stats := &GalleryAuthorStats{Id: authorId}

	var user User
	if err := DB.Omit("password", "access_token").First(&user, "id = ?", authorId).Error; err == nil {
		stats.Name = user.DisplayName
		if stats.Name == "" {
			stats.Name = user.Username
		}
		stats.Badge = user.GalleryBadge
	}

	var agg struct {
		Works int64
		Views int64
		Likes int64
	}
	if err := DB.Model(&PromptGallery{}).
		Select("count(*) AS works, COALESCE(sum(views), 0) AS views, COALESCE(sum(likes), 0) AS likes").
		Where("author_id = ? AND status = ?", authorId, PromptGalleryStatusPublished).
		Scan(&agg).Error; err != nil {
		return nil, err
	}
	stats.Works = agg.Works
	stats.Views = agg.Views
	stats.Likes = agg.Likes

	// 账号已删但作品还在：用作品上冗余的作者名兜底
	if stats.Name == "" {
		var name string
		DB.Model(&PromptGallery{}).
			Where("author_id = ?", authorId).
			Order("id DESC").
			Limit(1).
			Pluck("author", &name)
		stats.Name = name
	}
	if stats.Name == "" && stats.Works == 0 {
		return nil, gorm.ErrRecordNotFound
	}

	stats.Followers = CountGalleryAuthorFollowers(authorId)
	stats.Following = IsGalleryAuthorFollowed(viewerId, authorId)
	return stats, nil
}
