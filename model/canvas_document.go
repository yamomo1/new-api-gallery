package model

import (
	"strings"

	"gorm.io/gorm"

	"github.com/QuantumNous/new-api/common"
)

// CanvasDocument 画布文档（二开新增）
// 一份文档 = 一张画布。graph 字段整体以 JSON 文本存取，兼容：
//   - 现有 open-canvas 编辑器格式：{ nodes:[...], edges:[...], viewport:{x,y,zoom} }
//   - 未来 infinite-canvas 导出格式（同一字段承载，按需扩展）
//
// 画廊展示相关字段：
//   - visibility：public / private / unlist（公开画廊只列 public）
//   - thumbnail：封面 data URL（仅供画廊网格展示，列表不返回 graph 体）
//   - description：简介
//   - author：作者展示名（冗余存储，画廊直接读，避免逐条 join 用户表）
type CanvasDocument struct {
	Id          int64  `json:"id" gorm:"primaryKey;autoIncrement"`
	UserId      int    `json:"user_id" gorm:"index;not null"`
	Title       string `json:"title" gorm:"type:varchar(191);not null"`
	Graph       string `json:"graph" gorm:"type:mediumtext"` // 画布数据 JSON（可较大）
	Description string `json:"description" gorm:"type:text"`
	Visibility  string `json:"visibility" gorm:"type:varchar(16);index;default:'private'"` // public / private / unlist
	Thumbnail   string `json:"thumbnail" gorm:"type:text"`                                 // 封面 data URL
	Author      string `json:"author" gorm:"type:varchar(191);index"`                      // 作者展示名（冗余）
	CreatedAt   int64  `json:"created_at" gorm:"bigint"`
	UpdatedAt   int64  `json:"updated_at" gorm:"bigint"`
}

func (CanvasDocument) TableName() string {
	return "canvas_documents"
}

const (
	CanvasVisibilityPublic  = "public"
	CanvasVisibilityPrivate = "private"
	CanvasVisibilityUnlist  = "unlist"
)

// ListCanvasDocuments 我的画布列表（新→旧，不含 graph 体）
func ListCanvasDocuments(userId int) ([]CanvasDocument, error) {
	var items []CanvasDocument
	err := DB.Select("id, user_id, title, description, visibility, thumbnail, author, created_at, updated_at").
		Where("user_id = ?", userId).Order("id DESC").Find(&items).Error
	return items, err
}

// GetCanvasDocument 取单张画布（仅本人），含完整 graph
func GetCanvasDocument(userId int, id int64) (*CanvasDocument, error) {
	var item CanvasDocument
	err := DB.Where("id = ? AND user_id = ?", id, userId).First(&item).Error
	if err != nil {
		return nil, err
	}
	return &item, nil
}

// GetPublicCanvasDocument 取公开画布（visibility=public），含完整 graph（供打开）
func GetPublicCanvasDocument(id int64) (*CanvasDocument, error) {
	var item CanvasDocument
	err := DB.Where("id = ? AND visibility = ?", id, CanvasVisibilityPublic).First(&item).Error
	if err != nil {
		return nil, err
	}
	return &item, nil
}

// ListPublicCanvasDocuments 公开画廊列表（免登录），新→旧，不含 graph 体
func ListPublicCanvasDocuments(offset, limit int) ([]CanvasDocument, int64, error) {
	db := DB.Model(&CanvasDocument{}).Where("visibility = ?", CanvasVisibilityPublic)
	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var items []CanvasDocument
	err := db.Select("id, user_id, title, description, visibility, thumbnail, author, created_at, updated_at").
		Order("id DESC").Offset(offset).Limit(limit).Find(&items).Error
	return items, total, err
}

// CreateCanvasDocument 新建画布
func CreateCanvasDocument(item *CanvasDocument) error {
	item.Title = strings.TrimSpace(item.Title)
	if item.Title == "" {
		item.Title = "未命名画布"
	}
	if item.Visibility == "" {
		item.Visibility = CanvasVisibilityPrivate
	}
	now := common.GetTimestamp()
	item.CreatedAt = now
	item.UpdatedAt = now
	return DB.Create(item).Error
}

// UpdateCanvasDocument 更新画布（标题/图数据/描述/可见性/封面，任一可空）
func UpdateCanvasDocument(userId int, id int64, upd map[string]any) error {
	if len(upd) == 0 {
		return gorm.ErrInvalidData
	}
	upd["updated_at"] = common.GetTimestamp()
	res := DB.Model(&CanvasDocument{}).Where("id = ? AND user_id = ?", id, userId).Updates(upd)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

// DeleteCanvasDocument 删除画布（仅本人）
func DeleteCanvasDocument(userId int, id int64) error {
	res := DB.Where("id = ? AND user_id = ?", id, userId).Delete(&CanvasDocument{})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}
