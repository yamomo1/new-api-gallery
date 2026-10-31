package model

import (
	"sort"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// PromptGallery 提示词画廊条目
// 对标站 /api/prompt-gallery/v1/* 的数据模型（二开新增，官方无此模块）
type PromptGallery struct {
	Id        int64  `json:"id" gorm:"primaryKey;autoIncrement"`
	Title     string `json:"title" gorm:"type:text;not null"`
	Prompt    string `json:"prompt" gorm:"type:text;not null"`
	// PromptEn 英文版提示词（可选）：详情弹窗「英文/中文」双语 Tab 数据源
	PromptEn  string `json:"prompt_en" gorm:"type:text"`
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

	// ──「去创作」功能所需字段（二开新增）─────────────────────────────
	// WorkflowJson ComfyUI 工作流 JSON（API 格式），供「手动 Load / 拖入」
	// 与 ComfyUI 自定义节点一键生图共用。空串表示未配置工作流。
	WorkflowJson string `json:"workflow_json" gorm:"type:text"`
	// ModelSources 模型来源清单（JSON 数组字符串）。每一项含类型与下载地址，
	// 例如 [{"type":"huggingface","name":"xxlbase.safetensors","url":"..."},
	//        {"type":"quark","name":"...","url":"https://pan.quark.cn/s/xxxx"}]。
	// type=quark/netdisk 用于「网盘手动下载」；其余类型供节点/未来自动下载。
	ModelSources string `json:"model_sources" gorm:"type:text"`
	// RunningHubWorkflowId 云端 ComfyUI（RunningHub）工作流 ID，
	// 「去创作」点此跳转 RunningHub 体验页。
	RunningHubWorkflowId string `json:"runninghub_workflow_id" gorm:"type:varchar(64)"`

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
	Tags       []string `json:"tags"`
}

// PromptGalleryListQuery 列表查询参数
type PromptGalleryListQuery struct {
	Category string
	Search   string
	Type     string
	Model    string
	Tag      string
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
	if q.Tag != "" {
		db = db.Where("tags LIKE ?", "%"+strings.TrimSpace(q.Tag)+"%")
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

// PromptGallerySitemapItem 是生成 sitemap 用的最小字段集。
// 只取 id 与更新时间，避免把 prompt/media 这些大字段读进内存。
type PromptGallerySitemapItem struct {
	Id        int64 `gorm:"column:id"`
	UpdatedAt int64 `gorm:"column:updated_at"`
}

// ListPromptGallerySitemap 取已发布条目的 id 与更新时间（新→旧），供 sitemap 收录。
// limit <= 0 时用默认上限（sitemap 协议单文件 5 万条上限，这里留足余量）。
func ListPromptGallerySitemap(limit int) ([]PromptGallerySitemapItem, error) {
	if DB == nil {
		return nil, nil
	}
	if limit <= 0 {
		limit = 5000
	}
	var items []PromptGallerySitemapItem
	err := DB.Model(&PromptGallery{}).
		Select("id", "updated_at").
		Where("status = ?", PromptGalleryStatusPublished).
		Order("id DESC").
		Limit(limit).
		Scan(&items).Error
	return items, err
}

// GetPromptGalleryFacets 聚合分类/模型/类型/标签（仅统计已发布）
func GetPromptGalleryFacets() (*PromptGalleryFacet, error) {
	facet := &PromptGalleryFacet{Categories: []string{}, Models: []string{}, Types: []string{}, Tags: []string{}}

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
	// 预设模型补在真实模型之后：空库时筛选栏仍有可点的候选项。
	facet.Models = mergePresetValues(facet.Models, common.OptionMap["GalleryPresetModels"])
	if err := DB.Model(&PromptGallery{}).
		Where("status = ?", PromptGalleryStatusPublished).
		Distinct("type").Where("type <> ''").
		Pluck("type", &facet.Types).Error; err != nil {
		return nil, err
	}

	// 标签聚合：Tags 为逗号分隔字符串，按出现频次取前 24 个
	var tagRows []string
	if err := DB.Model(&PromptGallery{}).
		Where("status = ?", PromptGalleryStatusPublished).
		Where("tags <> ''").
		Pluck("tags", &tagRows).Error; err != nil {
		return nil, err
	}
	counter := map[string]int{}
	for _, raw := range tagRows {
		for _, tag := range strings.Split(raw, ",") {
			tag = strings.TrimSpace(tag)
			if tag == "" {
				continue
			}
			counter[tag]++
		}
	}
	tags := make([]string, 0, len(counter))
	for tag := range counter {
		tags = append(tags, tag)
	}
	sort.Slice(tags, func(i, j int) bool {
		if counter[tags[i]] != counter[tags[j]] {
			return counter[tags[i]] > counter[tags[j]]
		}
		return tags[i] < tags[j]
	})
	if len(tags) > 24 {
		tags = tags[:24]
	}
	// 预设标签补在真实标签之后：库里没作品时筛选栏也不会是空的。
	facet.Tags = mergePresetValues(tags, common.OptionMap["GalleryPresetTags"])
	return facet, nil
}

// mergePresetValues 把后台配置的预设值并入聚合结果，去重且保持「真实数据在前」。
// 这样运营既能看到库中实际存在的项，也能在空库时给出引导性候选项。
func mergePresetValues(actual []string, presetCSV string) []string {
	if strings.TrimSpace(presetCSV) == "" {
		return actual
	}
	seen := make(map[string]struct{}, len(actual))
	out := make([]string, 0, len(actual)+8)
	for _, v := range actual {
		v = strings.TrimSpace(v)
		if v == "" {
			continue
		}
		if _, ok := seen[strings.ToLower(v)]; ok {
			continue
		}
		seen[strings.ToLower(v)] = struct{}{}
		out = append(out, v)
	}
	for _, v := range strings.Split(presetCSV, ",") {
		v = strings.TrimSpace(v)
		if v == "" {
			continue
		}
		if _, ok := seen[strings.ToLower(v)]; ok {
			continue
		}
		seen[strings.ToLower(v)] = struct{}{}
		out = append(out, v)
	}
	return out
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
			"title":                  update.Title,
			"prompt":                 update.Prompt,
			"prompt_en":              update.PromptEn,
			"model":                  update.Model,
			"type":                   update.Type,
			"cover":                  update.Cover,
			"media":                  update.Media,
			"category":               update.Category,
			"tags":                   update.Tags,
			"workflow_json":          update.WorkflowJson,
			"model_sources":          update.ModelSources,
			"runninghub_workflow_id": update.RunningHubWorkflowId,
			"status":                 PromptGalleryStatusDraft,
			"updated_at":             common.GetTimestamp(),
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

// IncrPromptGalleryLikes 点赞数 +1，返回更新后的点赞数
func IncrPromptGalleryLikes(id int64) (int64, error) {
	res := DB.Model(&PromptGallery{}).Where("id = ?", id).
		UpdateColumn("likes", gorm.Expr("likes + 1"))
	if res.Error != nil {
		return 0, res.Error
	}
	var item PromptGallery
	if err := DB.Select("likes").First(&item, id).Error; err != nil {
		return 0, err
	}
	return int64(item.Likes), nil
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
		"title":                  update.Title,
		"prompt":                 update.Prompt,
		"prompt_en":              update.PromptEn,
		"model":                  update.Model,
		"type":                   update.Type,
		"cover":                  update.Cover,
		"media":                  update.Media,
		"category":               update.Category,
		"tags":                   update.Tags,
		"workflow_json":          update.WorkflowJson,
		"model_sources":          update.ModelSources,
		"runninghub_workflow_id": update.RunningHubWorkflowId,
		"updated_at":             common.GetTimestamp(),
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

// ----------------------------------------------------------------------------
// 收藏（跨端同步的关键）
//
// 画廊页与画布（canvas.* 独立域名）是两个前端，localStorage 不互通，
// 所以收藏必须落库：画廊页登录后写入本表，画布素材面板用同一个登录令牌读取，
// 用户收藏的图片/视频就能直接出现在画布的「素材 → 已收藏」里。
// ----------------------------------------------------------------------------

// PromptGalleryFavorite 用户收藏（userId + galleryId 唯一）
type PromptGalleryFavorite struct {
	Id        int64 `json:"id" gorm:"primaryKey;autoIncrement"`
	UserId    int   `json:"user_id" gorm:"uniqueIndex:idx_gallery_fav_user_prompt;index"`
	GalleryId int64 `json:"gallery_id" gorm:"uniqueIndex:idx_gallery_fav_user_prompt;index"`
	CreatedAt int64 `json:"created_at" gorm:"bigint"`
}

func (PromptGalleryFavorite) TableName() string {
	return "prompt_gallery_favorites"
}

// TogglePromptGalleryFavorite 收藏 / 取消收藏，返回 (toggle 后是否已收藏, 收藏总数)
func TogglePromptGalleryFavorite(userId int, galleryId int64) (bool, int64, error) {
	if userId <= 0 || galleryId <= 0 {
		return false, 0, gorm.ErrRecordNotFound
	}
	var existing PromptGalleryFavorite
	err := DB.Where("user_id = ? AND gallery_id = ?", userId, galleryId).First(&existing).Error
	favorited := false
	switch {
	case err == nil:
		if err := DB.Where("id = ?", existing.Id).Delete(&PromptGalleryFavorite{}).Error; err != nil {
			return false, 0, err
		}
	case err == gorm.ErrRecordNotFound:
		item := PromptGalleryFavorite{UserId: userId, GalleryId: galleryId, CreatedAt: common.GetTimestamp()}
		if err := DB.Clauses(clause.OnConflict{DoNothing: true}).Create(&item).Error; err != nil {
			return false, 0, err
		}
		favorited = true
	default:
		return false, 0, err
	}

	var total int64
	DB.Model(&PromptGalleryFavorite{}).Where("gallery_id = ?", galleryId).Count(&total)
	return favorited, total, nil
}

// IsPromptGalleryFavorited 是否已收藏
func IsPromptGalleryFavorited(userId int, galleryId int64) bool {
	if userId <= 0 || galleryId <= 0 {
		return false
	}
	var count int64
	DB.Model(&PromptGalleryFavorite{}).Where("user_id = ? AND gallery_id = ?", userId, galleryId).Count(&count)
	return count > 0
}

// ListFavoritePromptGalleryIDs 我收藏的作品 ID（新→旧）
func ListFavoritePromptGalleryIDs(userId int) ([]int64, error) {
	ids := make([]int64, 0)
	if userId <= 0 {
		return ids, nil
	}
	err := DB.Model(&PromptGalleryFavorite{}).
		Where("user_id = ?", userId).
		Order("id DESC").
		Pluck("gallery_id", &ids).Error
	return ids, err
}

// ListFavoritePromptGalleries 我收藏的作品（仅已发布，画布素材面板使用）
func ListFavoritePromptGalleries(userId int, offset, limit int) ([]PromptGallery, int64, error) {
	items := make([]PromptGallery, 0)
	if userId <= 0 {
		return items, 0, nil
	}
	if limit <= 0 || limit > 200 {
		limit = 100
	}
	base := DB.Table("prompt_gallery_favorites AS f").
		Joins("JOIN prompt_galleries AS p ON p.id = f.gallery_id").
		Where("f.user_id = ? AND p.status = ?", userId, PromptGalleryStatusPublished)

	var total int64
	if err := base.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	err := base.Select("p.*").Order("f.id DESC").Offset(offset).Limit(limit).Find(&items).Error
	return items, total, err
}
