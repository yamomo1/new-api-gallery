package galleryingest

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service/storage"

	"github.com/bytedance/gopkg/util/gopool"
	"github.com/google/uuid"
)

const (
	// 单轮最多提交多少条新任务（控制上游并发与花费）
	submitBatchSize = 3
	// 单轮最多轮询多少条在途任务
	pollBatchSize = 10
	// 单次产物下载上限（视频可能几十 MB）
	maxArtifactBytes = 128 << 20
)

var (
	runnerOnce    sync.Once
	runnerRunning atomic.Bool
	// lastTick 记录上一次调度时间，便于后台观察是否卡住
	lastTick atomic.Int64
)

// StartGalleryIngestTask 启动采集调度（仅主节点）
func StartGalleryIngestTask() {
	runnerOnce.Do(func() {
		if !common.IsMasterNode {
			return
		}
		interval := 20 * time.Second
		gopool.Go(func() {
			logger.LogInfo(context.Background(), common.LogText("gallery ingest task started: tick=%s", interval))
			ticker := time.NewTicker(interval)
			defer ticker.Stop()
			for range ticker.C {
				if !autoEnabled() {
					continue
				}
				RunOnce(context.Background())
			}
		})
	})
}

func autoEnabled() bool {
	return strings.EqualFold(opt("GalleryIngestAutoEnabled", "false"), "true")
}

// RunOnce 执行一轮：先提交待处理，再轮询在途任务
//
// 手动触发接口也走这里，方便排障。
func RunOnce(ctx context.Context) {
	if !runnerRunning.CompareAndSwap(false, true) {
		return // 上一轮还没跑完
	}
	defer runnerRunning.Store(false)
	lastTick.Store(time.Now().Unix())

	submitPending(ctx)
	pollInflight(ctx)
	reclaimStale(ctx)
}

// reclaimStale 回收卡死的任务
//
// 场景：进程在提交中途被 kill，任务停在 running 但没有 taskId，会永远占位。
// 规则：running 超过 30 分钟仍无 taskId → 退回 pending 重试；
//
//	有 taskId 但超过 60 分钟没结果 → 判定失败（交给人工重试）。
func reclaimStale(ctx context.Context) {
	now := common.GetTimestamp()
	if err := model.ReclaimStaleGalleryIngestJobs(now-30*60, now-60*60); err != nil {
		common.SysError("[gallery-ingest] 回收卡死任务失败: " + err.Error())
	}
}

// submitPending 把还没有上游 taskId 的任务提交出去
//
// 用 ClaimGalleryIngestJobs 做原子抢占（pending → running），
// 多实例部署时不会重复提交同一条种子。
func submitPending(ctx context.Context) {
	jobs, err := model.ClaimGalleryIngestJobs(submitBatchSize)
	if err != nil {
		common.SysError("[gallery-ingest] 领取待提交任务失败: " + err.Error())
		return
	}
	for _, job := range jobs {
		submitOne(ctx, job)
	}
}

func submitOne(ctx context.Context, job model.GalleryIngestJob) {
	provider, err := GetProvider(job.Provider)
	if err != nil {
		failJob(job.Id, err.Error())
		return
	}
	req := GenerateRequest{
		Prompt:     job.Prompt,
		Model:      job.Model,
		Type:       job.Type,
		Size:       job.Size,
		WorkflowId: job.WorkflowId,
	}
	if job.NodeOverrides != "" {
		var ov []NodeOverride
		if err := json.Unmarshal([]byte(job.NodeOverrides), &ov); err == nil {
			req.NodeOverrides = ov
		}
	}

	taskId, artifacts, err := provider.Submit(ctx, req)
	if err != nil {
		failJob(job.Id, err.Error())
		return
	}
	if len(artifacts) > 0 {
		// 同步上游：直接落库
		finalizeJob(ctx, job, artifacts)
		return
	}
	if err := model.UpdateGalleryIngestJob(job.Id, map[string]any{
		"upstream_task_id": taskId,
	}); err != nil {
		common.SysError("[gallery-ingest] 回写 taskId 失败: " + err.Error())
	}
}

// pollInflight 轮询已有 taskId 的任务
func pollInflight(ctx context.Context) {
	jobs, err := model.ListRunningGalleryIngestJobs(pollBatchSize)
	if err != nil {
		common.SysError("[gallery-ingest] 读取在途任务失败: " + err.Error())
		return
	}
	for _, job := range jobs {
		provider, err := GetProvider(job.Provider)
		if err != nil {
			failJob(job.Id, err.Error())
			continue
		}
		done, artifacts, err := provider.Poll(ctx, job.UpstreamTaskId)
		if err != nil {
			failJob(job.Id, err.Error())
			continue
		}
		if !done {
			// 心跳：告诉回收逻辑「这条还在正常轮询」
			model.TouchGalleryIngestJob(job.Id)
			continue
		}
		finalizeJob(ctx, job, artifacts)
	}
}

// finalizeJob 下载产物 → 转存本站存储 → 写入 prompt_galleries（draft）
func finalizeJob(ctx context.Context, job model.GalleryIngestJob, artifacts []Artifact) {
	remoteUrls := make([]string, 0, len(artifacts))
	localUrls := make([]string, 0, len(artifacts))
	mediaType := job.Type
	if mediaType == "" {
		mediaType = "image"
	}

	for _, art := range artifacts {
		remoteUrls = append(remoteUrls, art.URL)
		if art.Type == "video" {
			mediaType = "video"
		}
		url, err := persistArtifact(ctx, art)
		if err != nil {
			failJob(job.Id, "转存失败: "+err.Error())
			return
		}
		localUrls = append(localUrls, url)
	}
	if len(localUrls) == 0 {
		failJob(job.Id, "没有可用的产物")
		return
	}

	remoteJson, _ := json.Marshal(remoteUrls)
	localJson, _ := json.Marshal(localUrls)

	title := strings.TrimSpace(job.Title)
	if title == "" {
		title = makeTitle(job.Prompt)
	}
	author := opt("GalleryIngestAuthor", "cdymm studio")

	item := &model.PromptGallery{
		Title:     title,
		Prompt:    job.Prompt,
		PromptEn:  job.PromptEn,
		Model:     job.Model,
		Type:      mediaType,
		Cover:     localUrls[0],
		Media:     string(localJson),
		Category:  job.Category,
		Tags:      job.Tags,
		AuthorId:  0,
		Author:    author,
		Status:    model.PromptGalleryStatusDraft,
		CreatedAt: common.GetTimestamp(),
		UpdatedAt: common.GetTimestamp(),
	}
	if err := model.CreatePromptGallery(item); err != nil {
		failJob(job.Id, "写入画廊失败: "+err.Error())
		return
	}

	if err := model.UpdateGalleryIngestJob(job.Id, map[string]any{
		"status":      model.GalleryIngestStatusSuccess,
		"remote_urls": string(remoteJson),
		"local_urls":  string(localJson),
		"gallery_id":  item.Id,
		"error":       "",
	}); err != nil {
		common.SysError("[gallery-ingest] 回写成功状态失败: " + err.Error())
	}
	logger.LogInfo(ctx, common.LogText("gallery ingest success: job=%d gallery=%d", job.Id, item.Id))
}

// persistArtifact 把上游产物落到我们自己的对象存储，返回本站可访问地址
func persistArtifact(ctx context.Context, art Artifact) (string, error) {
	var data []byte
	var contentType string

	if strings.HasPrefix(art.URL, "b64:") {
		decoded, err := base64.StdEncoding.DecodeString(strings.TrimPrefix(art.URL, "b64:"))
		if err != nil {
			return "", fmt.Errorf("解码内联图片失败: %w", err)
		}
		data = decoded
		contentType = http.DetectContentType(data)
	} else {
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, art.URL, nil)
		if err != nil {
			return "", err
		}
		req.Header.Set("User-Agent", "Mozilla/5.0 (compatible; cdymm-gallery-ingest/1.0)")
		client := &http.Client{Timeout: 180 * time.Second}
		resp, err := client.Do(req)
		if err != nil {
			return "", err
		}
		defer resp.Body.Close()
		if resp.StatusCode != http.StatusOK {
			return "", fmt.Errorf("下载产物失败 HTTP %d", resp.StatusCode)
		}
		body, err := io.ReadAll(io.LimitReader(resp.Body, maxArtifactBytes+1))
		if err != nil {
			return "", err
		}
		if len(body) > maxArtifactBytes {
			return "", fmt.Errorf("产物超过 %dMB 上限", maxArtifactBytes>>20)
		}
		data = body
		contentType = resp.Header.Get("Content-Type")
		if contentType == "" {
			contentType = http.DetectContentType(data)
		}
	}

	provider, err := storage.Get()
	if err != nil {
		return "", fmt.Errorf("对象存储未就绪: %w", err)
	}
	key := fmt.Sprintf("gallery/%s/%s%s", time.Now().Format("20060102"), uuid.NewString(), extOf(contentType, art.Type))
	url, err := provider.Upload(key, contentType, data)
	if err != nil {
		return "", fmt.Errorf("上传到对象存储失败: %w", err)
	}

	// 海外镜像双写（失败不影响主流程），保证按地域解析时海外用户也能访问
	if _, ok := storage.GetOverseas(); ok {
		ovKey := key
		ovType := contentType
		ovData := data
		gopool.Go(func() {
			overseas, ok := storage.GetOverseas()
			if !ok {
				return
			}
			if _, err := overseas.Upload(ovKey, ovType, ovData); err != nil {
				common.SysError("[gallery-ingest] 海外镜像上传失败 key=" + ovKey + ": " + err.Error())
			}
		})
	}
	return url, nil
}

// extOf 由 content-type 推导文件后缀
func extOf(contentType, mediaType string) string {
	ct := strings.ToLower(strings.TrimSpace(strings.Split(contentType, ";")[0]))
	switch ct {
	case "image/png":
		return ".png"
	case "image/jpeg", "image/jpg":
		return ".jpg"
	case "image/webp":
		return ".webp"
	case "image/gif":
		return ".gif"
	case "video/mp4":
		return ".mp4"
	case "video/webm":
		return ".webm"
	case "video/quicktime":
		return ".mov"
	}
	if mediaType == "video" {
		return ".mp4"
	}
	return ".png"
}

func failJob(id int64, reason string) {
	if len(reason) > 900 {
		reason = reason[:900]
	}
	if err := model.UpdateGalleryIngestJob(id, map[string]any{
		"status": model.GalleryIngestStatusFailed,
		"error":  reason,
	}); err != nil {
		common.SysError("[gallery-ingest] 回写失败状态异常: " + err.Error())
	}
}

// makeTitle 用提示词首段兜一个可读标题
func makeTitle(prompt string) string {
	p := strings.TrimSpace(prompt)
	if p == "" {
		return "未命名作品"
	}
	// 优先按中英文句读切
	for _, sep := range []string{"\n", "。", ".", "，", ",", "；", ";"} {
		if i := strings.Index(p, sep); i > 8 {
			p = p[:i]
			break
		}
	}
	r := []rune(p)
	if len(r) > 40 {
		return string(r[:40])
	}
	return p
}
