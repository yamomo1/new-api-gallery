package model

import (
	"time"
)

// GalleryTranslateUsage 记录每一次「提示词自动翻译」的调用。
//
// 为什么单独建表而不是放在 gauge/counter 里：
//  1. 要按自然日统计「今天用了几次」，一条记录一次，COUNT(*) 就是答案，
//     不需要额外的日表或定时任务清理。
//  2. 扣没扣额外额度、调的是哪个模型、原文多长都要留痕，
//     用户来问「为什么我的额度少了」时能翻出凭据。
type GalleryTranslateUsage struct {
	Id int64 `json:"id" gorm:"primaryKey;autoIncrement"`

	UserId int    `json:"user_id" gorm:"index;not null"`
	Model  string `json:"model" gorm:"type:varchar(191)"`
	// Chars 原文字符数（截断后的），用于观察有没有人在拿这里烧 token。
	Chars int `json:"chars" gorm:"default:0"`
	// ChargedQuota 本次因为超出免费次数而额外扣除的额度；没扣就是 0。
	ChargedQuota int `json:"charged_quota" gorm:"default:0"`
	// Success 模型是否真的返回了译文。失败也记一笔：
	// 否则用户可以靠「反复触发失败」把次数刷爆。
	Success bool `json:"success" gorm:"default:false"`
	// IsAdminTest 管理员在后台自测提示词时置 true，不占用户配额口径。
	IsAdminTest bool `json:"is_admin_test" gorm:"default:false"`

	CreatedAt time.Time `json:"created_at" gorm:"index"`
}

func (GalleryTranslateUsage) TableName() string {
	return "gallery_translate_usage"
}

// startOfToday 返回本地时区今天零点。
//
// 自然日边界按服务器时区算 —— 站点面向单一语种用户，
// 没必要为一个「每日免费次数」引入 per-user 时区。
func startOfToday() time.Time {
	now := time.Now()
	return time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
}

// CountTranslateUsageToday 统计该用户今天已用的次数。
func CountTranslateUsageToday(userId int) (int64, error) {
	var count int64
	err := DB.Model(&GalleryTranslateUsage{}).
		Where("user_id = ? AND created_at >= ? AND is_admin_test = ?", userId, startOfToday(), false).
		Count(&count).Error
	return count, err
}

// RecordTranslateUsage 落一条调用记录，返回主键以便事后更新成败。
// 失败不阻塞主流程 —— 翻译本身已经成功了，不能因为记账失败就把结果扔掉。
func RecordTranslateUsage(userId int, model string, chars int, chargedQuota int, success bool, isAdminTest bool) int64 {
	record := &GalleryTranslateUsage{
		UserId:       userId,
		Model:        model,
		Chars:        chars,
		ChargedQuota: chargedQuota,
		Success:      success,
		IsAdminTest:  isAdminTest,
	}
	if err := DB.Create(record).Error; err != nil {
		return 0
	}
	return record.Id
}

// MarkTranslateUsageSuccess 标记某次调用真的拿到了译文。
// 记录先行（成功与否都要占次数），模型返回后再回填。
func MarkTranslateUsageSuccess(id int64) {
	if id <= 0 {
		return
	}
	_ = DB.Model(&GalleryTranslateUsage{}).Where("id = ?", id).Update("success", true).Error
}

// ClearTranslateCharge 把额外扣的额度退回去。
// 只在「超出免费次数、已扣钱、但模型最终失败了」时调用 ——
// 翻译没成还扣钱是最容易被投诉的情况。
func ClearTranslateCharge(id int64) {
	if id <= 0 {
		return
	}
	_ = DB.Model(&GalleryTranslateUsage{}).Where("id = ?", id).Updates(map[string]any{
		"charged_quota": 0,
		"success":       false,
	}).Error
}

// CleanupTranslateUsage 清掉 days 天前的旧记录。
// 只为控制表体积，不参与任何业务逻辑判断。
func CleanupTranslateUsage(days int) error {
	if days <= 0 {
		days = 90
	}
	deadline := time.Now().AddDate(0, 0, -days)
	return DB.Where("created_at < ?", deadline).Delete(&GalleryTranslateUsage{}).Error
}
