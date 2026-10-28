package model

import (
	"errors"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

// 画布工作台（infinite-canvas）专用令牌名称。
// 每个用户最多一个，用 UnlimitedQuota 让消耗记在用户额度上。
const CanvasStudioTokenName = "Canvas Studio"

// GetOrCreateCanvasToken 返回用户用于画布工作台的令牌，不存在则自动创建。
// 这样用户在画布/站内体验时无需自己创建 sk- 令牌，用量仍计入本人额度。
func GetOrCreateCanvasToken(userId int) (*Token, error) {
	if userId <= 0 {
		return nil, errors.New("invalid user id")
	}

	var token Token
	err := DB.Where("user_id = ? AND name = ?", userId, CanvasStudioTokenName).First(&token).Error
	if err == nil {
		// 被手动禁用/删除过就恢复，保证画布始终可用
		if token.Status != common.TokenStatusEnabled || token.ExpiredTime != -1 {
			DB.Model(&token).Updates(map[string]any{
				"status":       common.TokenStatusEnabled,
				"expired_time": -1,
			})
			token.Status = common.TokenStatusEnabled
			token.ExpiredTime = -1
		}
		return &token, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	key, err := common.GenerateKey()
	if err != nil {
		return nil, err
	}
	now := common.GetTimestamp()
	token = Token{
		UserId:              userId,
		Name:                CanvasStudioTokenName,
		Key:                 key,
		Status:              common.TokenStatusEnabled,
		CreatedTime:         now,
		AccessedTime:        now,
		ExpiredTime:         -1,
		RemainQuota:         0,
		UnlimitedQuota:      true,
		AllowUserQuotaQuery: true,
	}
	if err := DB.Create(&token).Error; err != nil {
		// 并发下可能已被另一个请求创建，回读一次
		var existing Token
		if e := DB.Where("user_id = ? AND name = ?", userId, CanvasStudioTokenName).First(&existing).Error; e == nil {
			return &existing, nil
		}
		return nil, err
	}
	return &token, nil
}
