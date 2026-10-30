// Package galleryingest 画廊内容自动采集
//
// 链路：提示词种子 → 上游生成（RunningHub / OpenAI 兼容生图 / LiblibAI）
//
//	→ 下载产物 → 转存到本站对象存储 → 以 draft 写入 prompt_galleries 待审核。
//
// 刻意不做「抓取他人社区作品」：那有版权与平台条款双重风险，且产物会热链上游 CDN。
// 这里只把上游当算力用，最终产物的权利链是干净的。
package galleryingest

import (
	"context"
	"errors"
	"strings"

	"github.com/QuantumNous/new-api/common"
)

// NodeOverride 上游工作流的节点参数覆盖（RunningHub nodeInfoList 语义）
type NodeOverride struct {
	NodeId     string `json:"nodeId"`
	FieldName  string `json:"fieldName"`
	FieldValue any    `json:"fieldValue"`
}

// GenerateRequest 一次生成请求
type GenerateRequest struct {
	Prompt        string
	Model         string
	Type          string // image / video
	Size          string
	WorkflowId    string
	NodeOverrides []NodeOverride
}

// Artifact 上游产物
type Artifact struct {
	URL  string `json:"url"`
	Type string `json:"type"` // image / video
}

// Provider 上游生成适配器
//
// 同步型 provider（如 OpenAI 兼容生图）在 Submit 里直接返回 artifacts，taskID 为空；
// 异步型 provider（RunningHub / Liblib）返回 taskID，由 Poll 收敛。
type Provider interface {
	Name() string
	Submit(ctx context.Context, req GenerateRequest) (taskID string, artifacts []Artifact, err error)
	Poll(ctx context.Context, taskID string) (done bool, artifacts []Artifact, err error)
}

// opt 读配置项，缺失或空值时回落到默认值
func opt(key, def string) string {
	if v, ok := common.OptionMap[key]; ok {
		if s := strings.TrimSpace(v); s != "" {
			return s
		}
	}
	return def
}

// GetProvider 按名称取上游适配器
func GetProvider(name string) (Provider, error) {
	switch strings.ToLower(strings.TrimSpace(name)) {
	case "", "runninghub":
		return &runningHubProvider{}, nil
	case "openai_image", "openai":
		return &openAIImageProvider{}, nil
	case "liblib", "liblibai":
		return &liblibProvider{}, nil
	default:
		return nil, errors.New("未知的上游类型: " + name)
	}
}
