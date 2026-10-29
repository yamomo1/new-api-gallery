package storage

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// LocalProvider 把文件保存到本地磁盘目录，并通过静态路由对外提供访问。
// 默认目录 /data/uploads（与 deploy 的 bind mount 对齐，重启不丢），
// 静态路由 /storage/static 由 router 注册。
type LocalProvider struct {
	Root    string // 绝对目录
	BaseURL string // 对外访问前缀，如 /storage/static
}

// NewLocal 构造本地存储。prefix 为 ""（国内主存储，StorageXxx）或 "Overseas"（StorageOverseasXxx）。
func NewLocal(prefix string) *LocalProvider {
	root := opt("Storage"+prefix+"LocalDir", "/data/uploads")
	base := opt("Storage"+prefix+"LocalBaseURL", "/storage/static")
	return &LocalProvider{Root: root, BaseURL: strings.TrimRight(base, "/")}
}

func (p *LocalProvider) Upload(key, contentType string, data []byte) (string, error) {
	clean := filepath.Clean("/" + key) // 规整，去掉前导斜杠
	full := filepath.Join(p.Root, clean)

	// 防目录穿越：确保最终路径仍在 Root 内
	rel, err := filepath.Rel(p.Root, full)
	if err != nil || strings.HasPrefix(rel, "..") {
		return "", fmt.Errorf("invalid storage key: %s", key)
	}
	if err := os.MkdirAll(filepath.Dir(full), 0o755); err != nil {
		return "", err
	}
	if err := os.WriteFile(full, data, 0o644); err != nil {
		return "", err
	}
	return p.BaseURL + "/" + strings.TrimPrefix(clean, "/"), nil
}
