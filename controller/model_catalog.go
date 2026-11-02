package controller

import (
	"net/http"

	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

// GetModelCatalog 前台「选择模型」弹窗的数据源。
//
// 与后台 /api/models/ 的区别：那条是超管接口且带渠道/价格等敏感信息；
// 这条只暴露模型名、说明、图标、标签、供应商名与端点类型，任何登录用户可读。
//
// 模型说明/图标/标签来自「模型资料」（model 表），未配置时字段为空，
// 前端会回退到供应商图标与默认占位。
func GetModelCatalog(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    model.GetPublicModelCatalog(),
	})
}
