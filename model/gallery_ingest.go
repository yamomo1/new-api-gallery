package model

import (
	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

// GalleryIngestJob 画廊自动采集任务
//
// 设计意图：不抓别人的作品（版权风险），而是把「提示词种子」投给上游生成，
// 产物下载后转存到本站对象存储，最终以 draft 状态写入 prompt_galleries 等人工审核。
// 这样产物的权利链是干净的（我们自己生成），也不会热链上游 CDN。
type GalleryIngestJob struct {
	Id int64 `json:"id" gorm:"primaryKey;autoIncrement"`

	// Provider 上游适配器标识：runninghub / openai_image / liblib
	Provider string `json:"provider" gorm:"type:varchar(32);not null;index"`
	// Status pending / running / success / failed / canceled
	Status string `json:"status" gorm:"type:varchar(16);not null;index;default:pending"`

	// —— 种子输入 ——
	Title    string `json:"title" gorm:"type:varchar(255)"`
	Prompt   string `json:"prompt" gorm:"type:text;not null"`
	PromptEn string `json:"prompt_en" gorm:"type:text"`
	Model    string `json:"model" gorm:"type:varchar(191)"`
	Type     string `json:"type" gorm:"type:varchar(16);default:image"`
	Category string `json:"category" gorm:"type:varchar(64)"`
	Tags     string `json:"tags" gorm:"type:text"`
	Size     string `json:"size" gorm:"type:varchar(32)"`

	// —— 上游执行 ——
	WorkflowId     string `json:"workflow_id" gorm:"type:varchar(64)"`
	NodeOverrides  string `json:"node_overrides" gorm:"type:text"` // JSON 数组：[{"nodeId":"6","fieldName":"text","fieldValue":"..."}]
	UpstreamTaskId string `json:"upstream_task_id" gorm:"type:varchar(191);index"`

	// —— 产物 ——
	RemoteUrls string `json:"remote_urls" gorm:"type:text"` // 上游原始地址 JSON 数组
	LocalUrls  string `json:"local_urls" gorm:"type:text"`  // 转存到本站存储后的地址 JSON 数组
	GalleryId  int64  `json:"gallery_id" gorm:"index"`

	Error     string `json:"error" gorm:"type:text"`
	Attempts  int    `json:"attempts" gorm:"default:0"`
	CreatedAt int64  `json:"created_at" gorm:"bigint;index"`
	UpdatedAt int64  `json:"updated_at" gorm:"bigint"`
}

func (GalleryIngestJob) TableName() string {
	return "gallery_ingest_jobs"
}

const (
	GalleryIngestStatusPending  = "pending"
	GalleryIngestStatusRunning  = "running"
	GalleryIngestStatusSuccess  = "success"
	GalleryIngestStatusFailed   = "failed"
	GalleryIngestStatusCanceled = "canceled"
)

// ClaimGalleryIngestJobs 原子领取一批 pending 任务（置为 running 并返回）。
// 用单条 UPDATE ... WHERE id IN (子查询) 的写法避免多实例重复领取。
func ClaimGalleryIngestJobs(limit int) ([]GalleryIngestJob, error) {
	if limit <= 0 {
		limit = 5
	}
	var ids []int64
	if err := DB.Model(&GalleryIngestJob{}).
		Where("status = ?", GalleryIngestStatusPending).
		Order("id asc").
		Limit(limit).
		Pluck("id", &ids).Error; err != nil {
		return nil, err
	}
	if len(ids) == 0 {
		return nil, nil
	}
	now := common.GetTimestamp()
	// 仅当仍为 pending 时才抢占，防止并发重复
	res := DB.Model(&GalleryIngestJob{}).
		Where("id IN ? AND status = ?", ids, GalleryIngestStatusPending).
		Updates(map[string]any{
			"status":     GalleryIngestStatusRunning,
			"attempts":   gorm.Expr("attempts + 1"),
			"updated_at": now,
			"error":      "",
		})
	if res.Error != nil {
		return nil, res.Error
	}
	var jobs []GalleryIngestJob
	if err := DB.Where("id IN ? AND status = ?", ids, GalleryIngestStatusRunning).
		Order("id asc").Find(&jobs).Error; err != nil {
		return nil, err
	}
	return jobs, nil
}

// ListRunningGalleryIngestJobs 取出仍在等待上游的任务（用于轮询阶段）
func ListRunningGalleryIngestJobs(limit int) ([]GalleryIngestJob, error) {
	if limit <= 0 {
		limit = 20
	}
	var jobs []GalleryIngestJob
	err := DB.Where("status = ? AND upstream_task_id <> ''", GalleryIngestStatusRunning).
		Order("updated_at asc").Limit(limit).Find(&jobs).Error
	return jobs, err
}

// ListPendingGalleryIngestJobs 待提交任务（未拿到上游 taskId 的）
func ListPendingGalleryIngestJobs(limit int) ([]GalleryIngestJob, error) {
	if limit <= 0 {
		limit = 10
	}
	var jobs []GalleryIngestJob
	err := DB.Where("status = ? AND (upstream_task_id = '' OR upstream_task_id IS NULL)", GalleryIngestStatusRunning).
		Order("id asc").Limit(limit).Find(&jobs).Error
	return jobs, err
}

// ReclaimStaleGalleryIngestJobs 回收卡死任务
//
// noTaskBefore：updated_at 早于此时刻且还没拿到上游 taskId → 退回 pending 重试
// withTaskBefore：updated_at 早于此时刻但有 taskId → 判定失败（多半上游已丢任务）
//
// updated_at 在轮询阶段会被当作心跳刷新，所以这里的时间差代表「多久没动静」。
func ReclaimStaleGalleryIngestJobs(noTaskBefore, withTaskBefore int64) error {
	now := common.GetTimestamp()
	if err := DB.Model(&GalleryIngestJob{}).
		Where("status = ? AND (upstream_task_id = '' OR upstream_task_id IS NULL) AND updated_at < ?",
			GalleryIngestStatusRunning, noTaskBefore).
		Updates(map[string]any{
			"status":     GalleryIngestStatusPending,
			"updated_at": now,
		}).Error; err != nil {
		return err
	}
	return DB.Model(&GalleryIngestJob{}).
		Where("status = ? AND upstream_task_id <> '' AND updated_at < ?",
			GalleryIngestStatusRunning, withTaskBefore).
		Updates(map[string]any{
			"status":     GalleryIngestStatusFailed,
			"error":      "上游任务超时未返回结果",
			"updated_at": now,
		}).Error
}

// TouchGalleryIngestJob 刷新 updated_at（轮询心跳，避免被超时回收误判）
func TouchGalleryIngestJob(id int64) {
	_ = DB.Model(&GalleryIngestJob{}).Where("id = ?", id).
		Update("updated_at", common.GetTimestamp()).Error
}

// UpdateGalleryIngestJob 更新任意字段
func UpdateGalleryIngestJob(id int64, fields map[string]any) error {
	fields["updated_at"] = common.GetTimestamp()
	return DB.Model(&GalleryIngestJob{}).Where("id = ?", id).Updates(fields).Error
}

// CreateGalleryIngestJobs 批量写入种子
func CreateGalleryIngestJobs(jobs []GalleryIngestJob) error {
	if len(jobs) == 0 {
		return nil
	}
	now := common.GetTimestamp()
	for i := range jobs {
		jobs[i].CreatedAt = now
		jobs[i].UpdatedAt = now
		if jobs[i].Status == "" {
			jobs[i].Status = GalleryIngestStatusPending
		}
		if jobs[i].Type == "" {
			jobs[i].Type = "image"
		}
	}
	return DB.CreateInBatches(jobs, 100).Error
}

// GalleryIngestStats 采集队列概览
type GalleryIngestStats struct {
	Pending int64 `json:"pending"`
	Running int64 `json:"running"`
	Success int64 `json:"success"`
	Failed  int64 `json:"failed"`
	Total   int64 `json:"total"`
}

func GetGalleryIngestStats() (*GalleryIngestStats, error) {
	stats := &GalleryIngestStats{}
	rows, err := DB.Model(&GalleryIngestJob{}).
		Select("status, count(*) as cnt").Group("status").Rows()
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var status string
		var cnt int64
		if err := rows.Scan(&status, &cnt); err != nil {
			continue
		}
		switch status {
		case GalleryIngestStatusPending:
			stats.Pending = cnt
		case GalleryIngestStatusRunning:
			stats.Running = cnt
		case GalleryIngestStatusSuccess:
			stats.Success = cnt
		case GalleryIngestStatusFailed:
			stats.Failed = cnt
		}
		stats.Total += cnt
	}
	return stats, nil
}

// ListGalleryIngestJobs 后台列表（支持按状态过滤）
func ListGalleryIngestJobs(status string, offset, limit int) ([]GalleryIngestJob, int64, error) {
	q := DB.Model(&GalleryIngestJob{})
	if status != "" {
		q = q.Where("status = ?", status)
	}
	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var jobs []GalleryIngestJob
	if err := q.Order("id desc").Offset(offset).Limit(limit).Find(&jobs).Error; err != nil {
		return nil, 0, err
	}
	return jobs, total, nil
}

// RetryGalleryIngestJob 把失败任务重置为 pending 重新排队
func RetryGalleryIngestJob(id int64) error {
	return UpdateGalleryIngestJob(id, map[string]any{
		"status":           GalleryIngestStatusPending,
		"upstream_task_id": "",
		"error":            "",
	})
}

// DeleteGalleryIngestJob 删除记录
func DeleteGalleryIngestJob(id int64) error {
	return DB.Delete(&GalleryIngestJob{}, id).Error
}
