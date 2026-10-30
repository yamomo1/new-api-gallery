package watermark

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service/storage"
)

// BackfillState 是存量补打任务的运行状态快照。
type BackfillState struct {
	Running    bool   `json:"running"`
	DryRun     bool   `json:"dry_run"`
	Total      int    `json:"total"`
	Processed  int    `json:"processed"`
	Updated    int    `json:"updated"`
	Skipped    int    `json:"skipped"`
	Failed     int    `json:"failed"`
	StartedAt  int64  `json:"started_at"`
	FinishedAt int64  `json:"finished_at"`
	Message    string `json:"message"`
}

var (
	backfillMu    sync.RWMutex
	backfillState = BackfillState{}
)

// BackfillStatus 返回当前补打任务状态。
func BackfillStatus() BackfillState {
	backfillMu.RLock()
	defer backfillMu.RUnlock()
	return backfillState
}

// StartBackfill 启动存量补打。limit 为本次处理的记录条数上限（0 表示全量）。
// dryRun 只统计不写入，用于上线前先摸底「有多少文件会被改动」。
//
// 同一时间只允许一个任务在跑，重复调用返回错误而不是排队——
// 这个操作会覆盖线上文件，宁可让管理员等，也不要并发跑两遍。
func StartBackfill(limit int, dryRun bool) error {
	backfillMu.Lock()
	if backfillState.Running {
		backfillMu.Unlock()
		return fmt.Errorf("已有补打任务在运行中")
	}
	backfillState = BackfillState{
		Running:   true,
		DryRun:    dryRun,
		StartedAt: time.Now().Unix(),
		Message:   "正在统计待处理记录…",
	}
	backfillMu.Unlock()

	go runBackfill(limit, dryRun)
	return nil
}

// runBackfill 逐条扫描画廊记录，给 cover 与 media 里的本域文件补打标识。
func runBackfill(limit int, dryRun bool) {
	defer func() {
		if r := recover(); r != nil {
			common.SysError(fmt.Sprintf("[watermark-backfill] panic: %v", r))
			backfillMu.Lock()
			backfillState.Running = false
			backfillState.Message = fmt.Sprintf("任务异常终止: %v", r)
			backfillState.FinishedAt = time.Now().Unix()
			backfillMu.Unlock()
		}
	}()

	cfg := LoadConfig()
	if !cfg.Enabled {
		finishBackfill("水印总开关已关闭，未执行")
		return
	}

	type row struct {
		Id    int
		Cover string
		Media string
	}

	lastId := 0
	batch := 50
	processedRows := 0

	for {
		var rows []row
		err := model.DB.Model(&model.PromptGallery{}).
			Select("id, cover, media").
			Where("id > ?", lastId).
			Order("id asc").
			Limit(batch).
			Find(&rows).Error
		if err != nil {
			finishBackfill("读取画廊记录失败: " + err.Error())
			return
		}
		if len(rows) == 0 {
			break
		}

		for _, r := range rows {
			lastId = r.Id
			processedRows++

			urls := collectRowURLs(r.Cover, r.Media)
			for _, u := range urls {
				updateBackfillProgress(r.Id, u)
				outcome := backfillOne(u, cfg, dryRun)
				accumulate(outcome)
			}

			if limit > 0 && processedRows >= limit {
				finishBackfill(fmt.Sprintf("已处理 %d 条记录（本次上限 %d）", processedRows, limit))
				return
			}
		}
	}

	finishBackfill(fmt.Sprintf("完成，共扫描 %d 条记录", processedRows))
}

// collectRowURLs 汇总一条记录里所有需要处理的媒体地址（去重）。
func collectRowURLs(cover, media string) []string {
	seen := map[string]bool{}
	var out []string

	add := func(u string) {
		u = strings.TrimSpace(u)
		if u == "" || seen[u] {
			return
		}
		seen[u] = true
		out = append(out, u)
	}

	add(cover)
	if strings.TrimSpace(media) != "" {
		var list []string
		if err := json.Unmarshal([]byte(media), &list); err == nil {
			for _, m := range list {
				add(m)
			}
		}
	}
	return out
}

type backfillOutcome int

const (
	outcomeSkipped backfillOutcome = iota
	outcomeUpdated
	outcomeFailed
)

// backfillOne 处理单个文件：认领本域 key → 回读原文件 → 打标 → 覆盖写回。
func backfillOne(rawURL string, cfg Config, dryRun bool) backfillOutcome {
	key, ok := storage.ParseKeyFromURL(rawURL)
	if !ok {
		// 外链（上游直链、第三方图床）不属于我们管，跳过
		return outcomeSkipped
	}

	data, contentType, err := fetchOriginal(key)
	if err != nil {
		common.SysError("[watermark-backfill] 回读失败 key=" + key + ": " + err.Error())
		return outcomeFailed
	}

	if HasMark(data) {
		return outcomeSkipped
	}

	res := Process(data, contentType)
	if !res.Changed() {
		return outcomeSkipped
	}
	if dryRun {
		return outcomeUpdated
	}

	provider, err := storage.Get()
	if err != nil {
		return outcomeFailed
	}
	if _, err := provider.Upload(key, res.ContentType, res.Data); err != nil {
		common.SysError("[watermark-backfill] 覆盖写回失败 key=" + key + ": " + err.Error())
		return outcomeFailed
	}
	// 海外镜像同步补一份，否则国外用户仍看到未标识版本
	if overseas, ok := storage.GetOverseas(); ok {
		if _, err := overseas.Upload(key, res.ContentType, res.Data); err != nil {
			common.SysError("[watermark-backfill] 海外镜像写入失败 key=" + key + ": " + err.Error())
		}
	}
	return outcomeUpdated
}

// fetchOriginal 读取存储中的原始字节。
// 本地存储直接读盘（快且不依赖外网），其余后端走公开 URL 回源。
func fetchOriginal(key string) ([]byte, string, error) {
	if storage.CurrentKind() == storage.ProviderLocal {
		full := filepath.Join(storage.LocalRoot(), filepath.FromSlash(strings.TrimPrefix(key, "/")))
		data, err := os.ReadFile(full)
		if err != nil {
			return nil, "", err
		}
		ct := http.DetectContentType(data)
		return data, ct, nil
	}

	url := storage.PublicURL(key)
	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Get(url)
	if err != nil {
		return nil, "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, "", fmt.Errorf("HTTP %d", resp.StatusCode)
	}
	data, err := io.ReadAll(io.LimitReader(resp.Body, 200<<20))
	if err != nil {
		return nil, "", err
	}
	ct := resp.Header.Get("Content-Type")
	if ct == "" {
		ct = http.DetectContentType(data)
	}
	return data, ct, nil
}

func accumulate(o backfillOutcome) {
	backfillMu.Lock()
	defer backfillMu.Unlock()
	backfillState.Processed++
	switch o {
	case outcomeUpdated:
		backfillState.Updated++
	case outcomeFailed:
		backfillState.Failed++
	default:
		backfillState.Skipped++
	}
	backfillState.Total = backfillState.Processed
}

func updateBackfillProgress(id int, url string) {
	backfillMu.Lock()
	defer backfillMu.Unlock()
	backfillState.Message = fmt.Sprintf("正在处理 #%d %s", id, url)
}

func finishBackfill(msg string) {
	backfillMu.Lock()
	defer backfillMu.Unlock()
	backfillState.Running = false
	backfillState.Message = msg
	backfillState.FinishedAt = time.Now().Unix()
	backfillState.Total = backfillState.Processed
	common.SysLog("[watermark-backfill] " + msg)
}
