package model

import (
	"strings"

	"gorm.io/gorm"

	"github.com/QuantumNous/new-api/common"
)

// GalleryProject 工作台「项目 / 文件夹」分组（二开新增）
// 对标站 /canvas 工作台：作品可归入项目，项目可归入文件夹
type GalleryProject struct {
	Id        int64  `json:"id" gorm:"primaryKey;autoIncrement"`
	UserId    int    `json:"user_id" gorm:"index;not null"`
	Name      string `json:"name" gorm:"type:varchar(191);not null"`
	Kind      string `json:"kind" gorm:"type:varchar(16);index;default:project"` // project / folder
	Cover     string `json:"cover" gorm:"type:text"`                             // 项目封面（可选，空则前端渐变占位）
	CreatedAt int64  `json:"created_at" gorm:"bigint"`
	UpdatedAt int64  `json:"updated_at" gorm:"bigint"`
}

func (GalleryProject) TableName() string {
	return "gallery_projects"
}

const (
	GalleryProjectKindProject = "project"
	GalleryProjectKindFolder  = "folder"
)

// ListGalleryProjects 用户的全部项目/文件夹（新→旧）
func ListGalleryProjects(userId int) ([]GalleryProject, error) {
	var items []GalleryProject
	err := DB.Where("user_id = ?", userId).Order("id DESC").Find(&items).Error
	return items, err
}

// CreateGalleryProject 新建项目/文件夹
func CreateGalleryProject(item *GalleryProject) error {
	item.Name = strings.TrimSpace(item.Name)
	if item.Name == "" {
		return gorm.ErrInvalidData
	}
	if item.Kind != GalleryProjectKindFolder {
		item.Kind = GalleryProjectKindProject
	}
	now := common.GetTimestamp()
	item.CreatedAt = now
	item.UpdatedAt = now
	return DB.Create(item).Error
}

// UpdateGalleryProject 重命名（仅本人）
func UpdateGalleryProject(userId int, id int64, name string) error {
	name = strings.TrimSpace(name)
	if name == "" {
		return gorm.ErrInvalidData
	}
	res := DB.Model(&GalleryProject{}).
		Where("id = ? AND user_id = ?", id, userId).
		Updates(map[string]any{"name": name, "updated_at": common.GetTimestamp()})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

// DeleteGalleryProject 删除项目（仅本人）；组内作品移出（project_id=0）
func DeleteGalleryProject(userId int, id int64) error {
	err := DB.Transaction(func(tx *gorm.DB) error {
		res := tx.Where("id = ? AND user_id = ?", id, userId).Delete(&GalleryProject{})
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected == 0 {
			return gorm.ErrRecordNotFound
		}
		return tx.Model(&PromptGallery{}).
			Where("author_id = ? AND project_id = ?", userId, id).
			Update("project_id", 0).Error
	})
	return err
}
