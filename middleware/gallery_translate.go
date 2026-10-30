package middleware

import (
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/service/gallerytranslate"
	"github.com/gin-gonic/gin"
)

// TranslateModelKey 是与 Distribute 约定的注入键：
// Distribute 里 getModelRequest 会优先读它，读到了就不再解析请求体里的 model。
// 这样一来翻译接口可以用 {text} 这种极简入参，渠道选择照旧由后台配置的模型决定。
const TranslateModelKey = "resolved_task_model"

// GalleryTranslateModel 在 Distribute 之前把翻译模型名注入上下文。
//
// 顺序不能反：Distribute 一旦跑完，渠道早就选好了，
// 这时候再告诉它用哪个模型已经晚了。
//
// 另一个职责是「没有可用模型就立刻报错」：否则请求会一路走到 Distribute，
// 由它抛出「必须提供 model」的通用报错，前端就收不到「请先启用渠道」的指引。
func GalleryTranslateModel() func(c *gin.Context) {
	return func(c *gin.Context) {
		cfg := gallerytranslate.LoadConfig()
		modelName := gallerytranslate.PickModel(c.GetInt("id"), cfg)

		// 请求体里的 model 只有超管能覆盖（后台自测要临时换模型对比效果）。
		// 普通用户哪怕手搓请求也不行 —— 否则后台「指定便宜模型控成本」这条策略形同虚设，
		// 谁都能带上 model=gpt-4o 让站点替他付推理费。
		if c.GetInt("role") >= common.RoleRootUser {
			var body struct {
				Model string `json:"model"`
			}
			if err := common.UnmarshalBodyReusable(c, &body); err == nil {
				if m := strings.TrimSpace(body.Model); m != "" {
					modelName = m
				}
			}
		}

		if modelName == "" {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"message": "translate.no_model",
			})
			c.Abort()
			return
		}

		c.Set(TranslateModelKey, modelName)
		c.Next()
	}
}
