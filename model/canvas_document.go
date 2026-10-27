package model

import (
	"strings"

	"gorm.io/gorm"

	"github.com/QuantumNous/new-api/common"
)

// CanvasDocument 画布文档（二开新增）
// 对标站 /canvas/:id 无限画布：一份文档 = 一张画布，图数据（nodes/edges/viewport）以 JSON 文本整体存取。
// 图数据格式参考 open-canvas（MIT）：{ nodes: [{id,type,position,data}], edges: [...], viewport: {x,y,zoom} }
type CanvasDocument struct {
	Id        int64  `json:"id" gorm:"primaryKey;autoIncrement"`
	UserId    int    `json:"user_id" gorm:"index;not null"`
	Title     string `json:"title" gorm:"type:varchar(191);not null"`
	Graph     string `json:"graph" gorm:"type:text"` // 图数据 JSON 字符串（空表示新画布）
	CreatedAt int64  `json:"created_at" gorm:"bigint"`
	UpdatedAt int64  `json:"updated_at" gorm:"bigint"`
}

func (CanvasDocument) TableName() string {
	return "canvas_documents"
}

// ListCanvasDocuments 我的画布列表（新→旧，不含图数据体，避免列表过大）
func ListCanvasDocuments(userId int) ([]CanvasDocument, error) {
	var items []CanvasDocument
	err := DB.Select("id", "user_id", "title", "created_at", "updated_at").
		Where("user_id = ?", userId).Order("id DESC").Find(&items).Error
	return items, err
}

// GetCanvasDocument 取单张画布（仅本人），含完整图数据
func GetCanvasDocument(userId int, id int64) (*CanvasDocument, error) {
	var item CanvasDocument
	err := DB.Where("id = ? AND user_id = ?", id, userId).First(&item).Error
	if err != nil {
		return nil, err
	}
	return &item, nil
}

// CreateCanvasDocument 新建画布
func CreateCanvasDocument(item *CanvasDocument) error {
	item.Title = strings.TrimSpace(item.Title)
	if item.Title == "" {
		item.Title = "未命名画布"
	}
	now := common.GetTimestamp()
	item.CreatedAt = now
	item.UpdatedAt = now
	return DB.Create(item).Error
}

// UpdateCanvasDocument 更新画布（标题 / 图数据）
func UpdateCanvasDocument(userId int, id int64, title string, graph string) error {
	updates := map[string]any{
		"updated_at": common.GetTimestamp(),
	}
	if t := strings.TrimSpace(title); t != "" {
		updates["title"] = t
	}
	if graph != "" {
		updates["graph"] = graph
	}
	if len(updates) == 1 {
		return gorm.ErrInvalidData
	}
	res := DB.Model(&CanvasDocument{}).Where("id = ? AND user_id = ?", id, userId).Updates(updates)
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
