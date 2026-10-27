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
	// Home 管理员「首页显示」标记：勾选后该作品在公开列表（latest）里置顶，
	// 因此会优先出现在首页 03 画廊的自动来源里。
	Home bool `json:"home" gorm:"default:false;index"`
	// ProjectId 工作台所属项目/文件夹（0 = 未分组，对应 gallery_projects.id）
	ProjectId int64 `json:"project_id" gorm:"default:0;index"`
	CreatedAt int64 `json:"created_at" gorm:"bigint"`
	UpdatedAt int64 `json:"updated_at" gorm:"bigint"`
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
		// 管理员标了「首页显示」的作品置顶，其次按发布时间
		db = db.Order("home DESC, created_at DESC, id DESC")
	case "popular":
		db = db.Order("likes DESC, id DESC")
	case "featured":
		db = db.Order("home DESC, likes DESC, views DESC, id DESC")
	default: // related
		db = db.Order("home DESC, id DESC")
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

// MyGalleryQuery 工作台「个人作品」查询条件
type MyGalleryQuery struct {
	ProjectId   int64  // >=0 按项目过滤；-1 不过滤
	ProjectNone bool   // true 只看未分组（project_id = 0）
	Type        string // image / video / 空=全部
	Search      string // 标题/提示词模糊
	Sort        string // latest（默认，新→旧）/ oldest
}

// GetUserPromptGalleries 我的作品（登录用户，含草稿/被拒），支持工作台筛选
func GetUserPromptGalleries(userId int, q MyGalleryQuery, offset, limit int) ([]PromptGallery, int64, error) {
	db := DB.Model(&PromptGallery{}).Where("author_id = ?", userId)
	if q.ProjectNone {
		db = db.Where("project_id = 0")
	} else if q.ProjectId >= 0 {
		db = db.Where("project_id = ?", q.ProjectId)
	}
	if q.Type != "" {
		db = db.Where("type = ?", q.Type)
	}
	if q.Search != "" {
		like := "%" + strings.TrimSpace(q.Search) + "%"
		db = db.Where("title LIKE ? OR prompt LIKE ?", like, like)
	}
	if q.Sort == "oldest" {
		db = db.Order("id ASC")
	} else {
		db = db.Order("id DESC")
	}

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

// SetPromptGalleryProject 移动作品到项目/文件夹（仅作者；不动审核状态）
func SetPromptGalleryProject(userId int, id int64, projectId int64) error {
	res := DB.Model(&PromptGallery{}).
		Where("id = ? AND author_id = ?", id, userId).
		Updates(map[string]any{"project_id": projectId, "updated_at": common.GetTimestamp()})
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

// AdminPromptGalleryQuery 后台列表筛选条件
// Status 审核状态 / Type 图片视频 / Model 模型 / Category 分类
// Search 标题·提示词·模型·作者模糊搜索 / Sort newest|oldest|views|likes
type AdminPromptGalleryQuery struct {
	Status   string
	Type     string
	Model    string
	Category string
	Search   string
	Sort     string
}

// AdminPromptGalleryFacet 后台筛选栏用的可选值（全量数据，不限状态）
type AdminPromptGalleryFacet struct {
	Models     []string `json:"models"`
	Categories []string `json:"categories"`
}

// AdminListPromptGalleries 管理员全量列表（含未审核/草稿/被拒），支持筛选与排序
func AdminListPromptGalleries(q AdminPromptGalleryQuery, offset, limit int) ([]PromptGallery, int64, error) {
	db := DB.Model(&PromptGallery{})
	if q.Status != "" {
		db = db.Where("status = ?", q.Status)
	}
	if q.Type != "" {
		db = db.Where("type = ?", q.Type)
	}
	if q.Model != "" {
		db = db.Where("model = ?", q.Model)
	}
	if q.Category != "" {
		db = db.Where("category = ?", q.Category)
	}
	if q.Search != "" {
		like := "%" + strings.TrimSpace(q.Search) + "%"
		db = db.Where("title LIKE ? OR prompt LIKE ? OR model LIKE ? OR author LIKE ?", like, like, like, like)
	}

	switch q.Sort {
	case "views":
		db = db.Order("views DESC, id DESC")
	case "likes":
		db = db.Order("likes DESC, id DESC")
	case "oldest":
		db = db.Order("id ASC")
	default: // newest
		db = db.Order("id DESC")
	}

	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var items []PromptGallery
	err := db.Offset(offset).Limit(limit).Find(&items).Error
	return items, total, err
}

// AdminPromptGalleryFacets 后台筛选栏的可选模型/分类（全量，不限审核状态）
func AdminPromptGalleryFacets() (*AdminPromptGalleryFacet, error) {
	facet := &AdminPromptGalleryFacet{Models: []string{}, Categories: []string{}}
	if err := DB.Model(&PromptGallery{}).
		Distinct("model").Where("model <> ''").Order("model ASC").
		Pluck("model", &facet.Models).Error; err != nil {
		return nil, err
	}
	if err := DB.Model(&PromptGallery{}).
		Distinct("category").Where("category <> ''").Order("category ASC").
		Pluck("category", &facet.Categories).Error; err != nil {
		return nil, err
	}
	return facet, nil
}

// AdminSetPromptGalleryStatus 管理员审核（发布/驳回/退回待审）
func AdminSetPromptGalleryStatus(id int64, status string) error {
	if status != PromptGalleryStatusPublished && status != PromptGalleryStatusRejected && status != PromptGalleryStatusDraft {
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

// AdminUpdatePromptGallery 管理员编辑作品（不限作者，不改审核状态）
func AdminUpdatePromptGallery(id int64, update *PromptGallery) error {
	res := DB.Model(&PromptGallery{}).Where("id = ?", id).Updates(map[string]any{
		"title":      update.Title,
		"prompt":     update.Prompt,
		"model":      update.Model,
		"type":       update.Type,
		"cover":      update.Cover,
		"media":      update.Media,
		"category":   update.Category,
		"tags":       update.Tags,
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

// AdminDeletePromptGallery 管理员删除作品（不限作者）
func AdminDeletePromptGallery(id int64) error {
	res := DB.Where("id = ?", id).Delete(&PromptGallery{})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

// AdminSetPromptGalleryHome 管理员设置「首页显示」（置顶到首页画廊）
func AdminSetPromptGalleryHome(id int64, home bool) error {
	res := DB.Model(&PromptGallery{}).Where("id = ?", id).Updates(map[string]any{
		"home":       home,
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
