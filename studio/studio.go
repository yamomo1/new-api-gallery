// Package studio 内嵌画布工作台（infinite-canvas）的前端产物。
//
// 为什么编进二进制而不是挂数据目录：
//   - 画布是纯静态站点（上游镜像就是 nginx + dist），没有后端进程；
//   - 编进二进制后「升级 new-api」就等于「升级画布」，不需要再手工上传文件，
//     也不会出现「镜像升了、画布还是旧的」这种两套版本对不上的情况；
//   - 部署面只剩一个容器、一个镜像，回滚镜像即回滚画布。
//
// dist 目录由 scripts/sync-studio.sh 生成/刷新（会跑一次 VITE base=/studio/ 的构建），
// 产物进 git，所以 clone 下来直接 go build 就自带画布。
//
// 想在不重建镜像的情况下临时换画布，设 CANVAS_STUDIO_DIR 指向别的目录即可（见 router 包）。
package studio

import (
	"embed"
	"encoding/json"
	"io/fs"
)

//go:embed all:dist
var embedded embed.FS

// DistFS 返回内嵌的画布产物，路径已剥离 "dist/" 前缀。
// 第二个返回值为 false 表示这个构建里没带画布（dist 里缺 index.html）。
func DistFS() (fs.FS, bool) {
	sub, err := fs.Sub(embedded, "dist")
	if err != nil {
		return nil, false
	}
	if _, err := fs.Stat(sub, "index.html"); err != nil {
		return nil, false
	}
	return sub, true
}

// BuildInfo 对应 dist/build-info.json，由同步脚本生成，用来确认「现在跑的是哪一版画布」。
type BuildInfo struct {
	Version  string `json:"version"`            // 取自画布仓库的短 commit
	Commit   string `json:"commit"`             // 完整 commit
	Branch   string `json:"branch"`             // 分支名
	BuiltAt  string `json:"builtAt"`            // 构建时间（UTC, RFC3339）
	Dirty    bool   `json:"dirty"`              // 构建时画布仓库有未提交改动
	FileNum  int    `json:"files"`              // 产物文件数
	SyncedBy string `json:"syncedBy,omitempty"` // 同步脚本版本
}

// 同步脚本会写进 dist，路径固定
const buildInfoName = "build-info.json"

// ReadBuildInfo 从给定的产物 FS 里读 build-info.json（可能不存在）
func ReadBuildInfo(fsys fs.FS) (BuildInfo, bool) {
	if fsys == nil {
		return BuildInfo{}, false
	}
	raw, err := fs.ReadFile(fsys, buildInfoName)
	if err != nil {
		return BuildInfo{}, false
	}
	var bi BuildInfo
	if err := json.Unmarshal(raw, &bi); err != nil {
		return BuildInfo{}, false
	}
	return bi, true
}

// Summary 给日志用的一行描述，尽量短
func (b BuildInfo) Summary() string {
	switch {
	case b.Version == "" && b.BuiltAt == "":
		return "版本未知"
	case b.Dirty:
		return b.Version + " (画布仓库有未提交改动) @ " + b.BuiltAt
	default:
		return b.Version + " @ " + b.BuiltAt
	}
}
