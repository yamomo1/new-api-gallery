package galleryingest

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// RunningHub 云端 ComfyUI 适配器
//
// 提交：POST /task/openapi/create   {apiKey, workflowId, nodeInfoList}
// 状态：POST /task/openapi/status   {apiKey, taskId}      → data: RUNNING / SUCCESS / FAILED
// 产物：POST /task/openapi/outputs  {apiKey, taskId}      → data: [{fileUrl, fileType, nodeId}]
//
// 注意：workflowId 对应的工作流必须在 RunningHub 网页端至少成功运行过一次，
// 否则 API 侧会报错。这一步属于一次性人工准备，采集器不代劳。
const runningHubBase = "https://www.runninghub.cn"

type runningHubProvider struct{}

func (p *runningHubProvider) Name() string { return "runninghub" }

type rhEnvelope struct {
	Code          int             `json:"code"`
	Msg           string          `json:"msg"`
	ErrorMessages json.RawMessage `json:"errorMessages"`
	Data          json.RawMessage `json:"data"`
}

func rhPost(ctx context.Context, path string, payload any) (*rhEnvelope, error) {
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, runningHubBase+path, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	// RunningHub 要求 Host 头必须精确为 www.runninghub.cn
	req.Host = "www.runninghub.cn"

	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(io.LimitReader(resp.Body, 4<<20))
	if err != nil {
		return nil, err
	}
	var env rhEnvelope
	if err := json.Unmarshal(raw, &env); err != nil {
		return nil, fmt.Errorf("RunningHub 返回非 JSON（HTTP %d）: %s", resp.StatusCode, truncate(string(raw), 200))
	}
	return &env, nil
}

func (p *runningHubProvider) Submit(ctx context.Context, req GenerateRequest) (string, []Artifact, error) {
	apiKey := opt("GalleryIngestRunningHubApiKey", "")
	if apiKey == "" {
		return "", nil, errors.New("未配置 GalleryIngestRunningHubApiKey")
	}
	workflowId := strings.TrimSpace(req.WorkflowId)
	if workflowId == "" {
		workflowId = opt("GalleryIngestRunningHubWorkflowId", "")
	}
	if workflowId == "" {
		return "", nil, errors.New("未配置 RunningHub workflowId")
	}

	payload := map[string]any{
		"apiKey":     apiKey,
		"workflowId": workflowId,
		// 不把提示词写进 PNG 元信息，避免产物里泄露工作流结构与上游信息
		"addMetadata": false,
	}
	if len(req.NodeOverrides) > 0 {
		payload["nodeInfoList"] = req.NodeOverrides
	}
	instanceType := opt("GalleryIngestRunningHubInstanceType", "")
	if instanceType != "" {
		payload["instanceType"] = instanceType
	}

	env, err := rhPost(ctx, "/task/openapi/create", payload)
	if err != nil {
		return "", nil, err
	}
	if env.Code != 0 {
		return "", nil, fmt.Errorf("RunningHub 提交失败 [%d] %s", env.Code, env.Msg)
	}
	var data struct {
		TaskId     json.Number `json:"taskId"`
		TaskStatus string      `json:"taskStatus"`
		PromptTips string      `json:"promptTips"`
	}
	if err := json.Unmarshal(env.Data, &data); err != nil {
		return "", nil, fmt.Errorf("解析 RunningHub 提交结果失败: %w", err)
	}
	taskId := data.TaskId.String()
	if taskId == "" || taskId == "0" {
		return "", nil, errors.New("RunningHub 未返回 taskId")
	}
	if data.PromptTips != "" {
		return "", nil, fmt.Errorf("工作流校验未通过: %s", data.PromptTips)
	}
	return taskId, nil, nil
}

func (p *runningHubProvider) Poll(ctx context.Context, taskID string) (bool, []Artifact, error) {
	apiKey := opt("GalleryIngestRunningHubApiKey", "")
	if apiKey == "" {
		return false, nil, errors.New("未配置 GalleryIngestRunningHubApiKey")
	}

	// 1) 先查状态，区分「还在跑」和「真失败」
	env, err := rhPost(ctx, "/task/openapi/status", map[string]any{
		"apiKey": apiKey,
		"taskId": taskID,
	})
	if err != nil {
		return false, nil, err
	}
	if env.Code != 0 {
		return false, nil, fmt.Errorf("RunningHub 状态查询失败 [%d] %s", env.Code, env.Msg)
	}
	var status string
	if err := json.Unmarshal(env.Data, &status); err != nil {
		// 少数版本直接返回对象，尝试按对象取 taskStatus
		var obj struct {
			TaskStatus string `json:"taskStatus"`
		}
		if err2 := json.Unmarshal(env.Data, &obj); err2 == nil && obj.TaskStatus != "" {
			status = obj.TaskStatus
		} else {
			return false, nil, fmt.Errorf("无法解析任务状态: %s", truncate(string(env.Data), 120))
		}
	}
	switch strings.ToUpper(status) {
	case "SUCCESS":
		// 继续取产物
	case "FAILED", "CANCELED":
		return false, nil, fmt.Errorf("上游任务失败: %s", status)
	default:
		// QUEUED / RUNNING / CREATE
		return false, nil, nil
	}

	// 2) 取产物
	outEnv, err := rhPost(ctx, "/task/openapi/outputs", map[string]any{
		"apiKey": apiKey,
		"taskId": taskID,
	})
	if err != nil {
		return false, nil, err
	}
	if outEnv.Code != 0 {
		return false, nil, fmt.Errorf("RunningHub 产物查询失败 [%d] %s", outEnv.Code, outEnv.Msg)
	}
	var outputs []struct {
		FileUrl  string `json:"fileUrl"`
		FileType string `json:"fileType"`
		NodeId   string `json:"nodeId"`
	}
	if err := json.Unmarshal(outEnv.Data, &outputs); err != nil {
		return false, nil, fmt.Errorf("解析产物失败: %w", err)
	}
	artifacts := make([]Artifact, 0, len(outputs))
	for _, o := range outputs {
		if o.FileUrl == "" {
			continue
		}
		artifacts = append(artifacts, Artifact{URL: o.FileUrl, Type: normalizeMediaType(o.FileType, o.FileUrl)})
	}
	if len(artifacts) == 0 {
		return false, nil, errors.New("上游任务成功但没有产物")
	}
	return true, artifacts, nil
}

// normalizeMediaType 把上游的文件类型/后缀归一化成 image / video
func normalizeMediaType(fileType, url string) string {
	t := strings.ToLower(strings.TrimSpace(fileType))
	switch t {
	case "png", "jpg", "jpeg", "webp", "gif", "bmp":
		return "image"
	case "mp4", "webm", "mov", "mkv", "avi":
		return "video"
	}
	u := strings.ToLower(url)
	for _, ext := range []string{".mp4", ".webm", ".mov", ".mkv", ".avi"} {
		if strings.Contains(u, ext) {
			return "video"
		}
	}
	return "image"
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "..."
}
