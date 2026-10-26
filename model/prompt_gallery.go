package model

import (
	"strings"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

// PromptGallery 提示词画廊条目
// 对标站 /api/prompt-gallery/v1/* 的数据模型（二开新增，官方无此模块）
type PromptGallery struct {
	Id        int64  `json:"id" gorm:"primaryKey;autoIncrement"`
	Title     string `json:"title" gorm:"type:text;not null"`
	Prompt    string `json:"prompt" gorm:"type:text;not null"`
	Model     string `json:"model" gorm:"type:varchar(191);index"`
	Type      string `json:"type" gorm:"type:varchar(32);index;default:image"` // image / video
	Cover     string `json:"cover" gorm:"type:text"`
	Media     string `json:"media" gorm:"type:text"` // JSON 数组字符串，多张图/多段视频
	Category  string `json:"category" gorm:"type:varchar(64);index"`
	Tags      string `json:"tags" gorm:"type:text"` // 逗号分隔或 JSON 数组字符串
	AuthorId  int    `json:"author_id" gorm:"index"`
	Author    string `json:"author" gorm:"type:varchar(191);index"`
	Likes     int    `json:"likes" gorm:"default:0"`
	Views     int    `json:"views" gorm:"default:0"`
	Status    string `json:"status" gorm:"type:varchar(16);index;default:published"` // draft / published / rejected
	CreatedAt int64  `json:"created_at" gorm:"bigint"`
	UpdatedAt int64  `json:"updated_at" gorm:"bigint"`
}

func (PromptGallery) TableName() string {
	return "prompt_galleries"
}

// PromptGalleryFacet 聚合结果（分类/模型/标签，供筛选面板）
type PromptGalleryFacet struct {
	Categories []string `json:"categories"`
	Models     []string `json:"models"`
	Types      []string `json:"types"`
}

// PromptGalleryListQuery 列表查询参数
type PromptGalleryListQuery struct {
	Category string
	Search   string
	Type     string
	Model    string
	Sort     string // related / latest / featured / popular
	Offset   int
	Limit    int
}

const (
	PromptGalleryStatusPublished = "published"
	PromptGalleryStatusDraft     = "draft"
	PromptGalleryStatusRejected  = "rejected"
)

// GetPublishedPromptGalleries 公开列表（仅已发布），支持筛选/搜索/排序/分页
func GetPublishedPromptGalleries(q PromptGalleryListQuery) ([]PromptGallery, int64, error) {
	db := DB.Model(&PromptGallery{}).Where("status = ?", PromptGalleryStatusPublished)

	if q.Category != "" {
		db = db.Where("category = ?", q.Category)
	}
	if q.Type != "" {
		db = db.Where("type = ?", q.Type)
	}
	if q.Model != "" {
		db = db.Where("model = ?", q.Model)
	}
	if q.Search != "" {
		like := "%" + strings.TrimSpace(q.Search) + "%"
		db = db.Where("title LIKE ? OR prompt LIKE ? OR model LIKE ?", like, like, like)
	}

	switch q.Sort {
	case "latest":
		db = db.Order("created_at DESC, id DESC")
	case "popular":
		db = db.Order("likes DESC, id DESC")
	case "featured":
		db = db.Order("likes DESC, views DESC, id DESC")
	default: // related
		db = db.Order("id DESC")
	}

	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var items []PromptGallery
	err := db.Offset(q.Offset).Limit(q.Limit).Find(&items).Error
	return items, total, err
}

// GetPromptGalleryById 获取单条（公开详情，仅已发布）
func GetPromptGalleryById(id int64) (*PromptGallery, error) {
	var item PromptGallery
	err := DB.Where("id = ? AND status = ?", id, PromptGalleryStatusPublished).First(&item).Error
	if err != nil {
		return nil, err
	}
	return &item, nil
}

// GetPromptGalleryFacets 聚合分类/模型/类型（仅统计已发布）
func GetPromptGalleryFacets() (*PromptGalleryFacet, error) {
	facet := &PromptGalleryFacet{Categories: []string{}, Models: []string{}, Types: []string{}}

	if err := DB.Model(&PromptGallery{}).
		Where("status = ?", PromptGalleryStatusPublished).
		Distinct("category").Where("category <> ''").
		Pluck("category", &facet.Categories).Error; err != nil {
		return nil, err
	}
	if err := DB.Model(&PromptGallery{}).
		Where("status = ?", PromptGalleryStatusPublished).
		Distinct("model").Where("model <> ''").
		Pluck("model", &facet.Models).Error; err != nil {
		return nil, err
	}
	if err := DB.Model(&PromptGallery{}).
		Where("status = ?", PromptGalleryStatusPublished).
		Distinct("type").Where("type <> ''").
		Pluck("type", &facet.Types).Error; err != nil {
		return nil, err
	}
	return facet, nil
}

// GetUserPromptGalleries 我的作品（登录用户，含草稿/被拒）
func GetUserPromptGalleries(userId int, offset, limit int) ([]PromptGallery, int64, error) {
	db := DB.Model(&PromptGallery{}).Where("author_id = ?", userId).Order("id DESC")

	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var items []PromptGallery
	err := db.Offset(offset).Limit(limit).Find(&items).Error
	return items, total, err
}

// CreatePromptGallery 创建（默认草稿，管理员/审核后可发布）
func CreatePromptGallery(item *PromptGallery) error {
	if item.Status == "" {
		item.Status = PromptGalleryStatusDraft
	}
	now := common.GetTimestamp()
	item.CreatedAt = now
	item.UpdatedAt = now
	return DB.Create(item).Error
}

// UpdatePromptGallery 更新我的作品（仅作者本人；status 回退为草稿待重新审核）
func UpdatePromptGallery(userId int, id int64, update *PromptGallery) error {
	res := DB.Model(&PromptGallery{}).
		Where("id = ? AND author_id = ?", id, userId).
		Updates(map[string]any{
			"title":      update.Title,
			"prompt":     update.Prompt,
			"model":      update.Model,
			"type":       update.Type,
			"cover":      update.Cover,
			"media":      update.Media,
			"category":   update.Category,
			"tags":       update.Tags,
			"status":     PromptGalleryStatusDraft,
			"updated_at": common.GetTimestamp(),
		})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

// DeletePromptGallery 删除我的作品（仅作者本人）
func DeletePromptGallery(userId int, id int64) error {
	res := DB.Where("id = ? AND author_id = ?", id, userId).Delete(&PromptGallery{})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

// IncrPromptGalleryViews 浏览量 +1
func IncrPromptGalleryViews(id int64) {
	DB.Model(&PromptGallery{}).Where("id = ?", id).UpdateColumn("views", gorm.Expr("views + 1"))
}

// AdminListPromptGalleries 管理员全量列表（含未审核/草稿/被拒）
func AdminListPromptGalleries(status string, offset, limit int) ([]PromptGallery, int64, error) {
	db := DB.Model(&PromptGallery{})
	if status != "" {
		db = db.Where("status = ?", status)
	}
	db = db.Order("id DESC")

	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var items []PromptGallery
	err := db.Offset(offset).Limit(limit).Find(&items).Error
	return items, total, err
}

// AdminSetPromptGalleryStatus 管理员审核（发布/驳回）
func AdminSetPromptGalleryStatus(id int64, status string) error {
	if status != PromptGalleryStatusPublished && status != PromptGalleryStatusRejected {
		return common.NewMessage("Invalid gallery status")
	}
	res := DB.Model(&PromptGallery{}).Where("id = ?", id).Updates(map[string]any{
		"status":     status,
		"updated_at": common.GetTimestamp(),
	})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}
