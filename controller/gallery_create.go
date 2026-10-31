/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

package controller

import (
	"encoding/json"
	"io"
	"net/http"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service/gallerycreate"
	"github.com/gin-gonic/gin"
)

// ModelSource 是 model_sources JSON 数组里的单项。
// type 取值：huggingface / civitai / oss / quark / netdisk 等；
// quark/netdisk 用于「网盘手动下载」，其余类型供节点未来自动拉取。
type ModelSource struct {
	Type string `json:"type"`
	Name string `json:"name"`
	URL  string `json:"url"`
	// Dir 目标子目录（ComfyUI models 下），如 checkpoints / loras / vae。
	// 留空则由节点按文件名猜或落到 checkpoints。
	Dir string `json:"dir,omitempty"`
	// Sha256 可选，用于节点侧校验文件完整性。
	Sha256 string `json:"sha256,omitempty"`
}

// GalleryCreatePayload 「去创作」拉取的数据包：ComfyUI 自定义节点与
// 手动工作流功能都消费它。内容本身已公开（就是作品的工作流与模型信息），
// 所以接口不要求登录。
type GalleryCreatePayload struct {
	GalleryID            int64         `json:"gallery_id"`
	Title                string        `json:"title"`
	Prompt               string        `json:"prompt"`
	// WorkflowJson ComfyUI 工作流 JSON（API 格式），空串表示未配置。
	WorkflowJson string `json:"workflow_json"`
	// ModelSources 解析后的模型来源清单。
	ModelSources []ModelSource `json:"model_sources"`
	// RunningHubWorkflowId 云端工作流 ID，空串表示未配置。
	RunningHubWorkflowId string `json:"runninghub_workflow_id"`
}

// GetGalleryCreateConfig 返回四个「去创作」功能的开关（公开，前端据此决定展示哪些入口）。
func GetGalleryCreateConfig(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"success": true, "data": gallerycreate.LoadConfig()})
}

// UpdateGalleryCreateConfig 保存四个开关（仅超管）。
// 请求体是完整 Config JSON（四个 bool）；先校验能解析，再落 Option。
func UpdateGalleryCreateConfig(c *gin.Context) {
	body, err := io.ReadAll(io.LimitReader(c.Request.Body, 16*1024))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "读取请求体失败"})
		return
	}
	raw := strings.TrimSpace(string(body))
	if raw == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "请求体不是合法的 JSON"})
		return
	}
	var probe gallerycreate.Config
	if err := json.Unmarshal([]byte(raw), &probe); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "请求体不是合法的 JSON"})
		return
	}
	if err := gallerycreate.SaveConfig(raw); err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": gallerycreate.LoadConfig()})
}

// GetGalleryCreatePayload 返回某作品「去创作」所需的全部数据
// （工作流 JSON + 模型来源 + RunningHub 工作流 ID）。公开接口。
//
//	GET /api/prompt-gallery/v1/prompts/:id/create
func GetGalleryCreatePayload(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		common.ApiErrorT(c, "Invalid gallery id")
		return
	}
	item, err := model.GetPromptGalleryById(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	var sources []ModelSource
	if strings.TrimSpace(item.ModelSources) != "" {
		// 解析失败不致命：返回空清单，前端只少展示模型项，不至于整个接口挂掉。
		_ = json.Unmarshal([]byte(item.ModelSources), &sources)
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": GalleryCreatePayload{
			GalleryID:            item.Id,
			Title:                item.Title,
			Prompt:               item.Prompt,
			WorkflowJson:         item.WorkflowJson,
			ModelSources:         sources,
			RunningHubWorkflowId: item.RunningHubWorkflowId,
		},
	})
}
