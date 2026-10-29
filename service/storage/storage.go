package storage

import (
	"strings"
	"sync"

	"github.com/QuantumNous/new-api/common"
)

// Provider 是统一的对象存储抽象。所有实现都把文件存好并返回可公开访问的 URL。
type Provider interface {
	// Upload 保存 data 并返回可访问的 URL。
	// key 形如 uploads/20060102/<uuid>.<ext>（相对路径，不含前导斜杠）。
	Upload(key, contentType string, data []byte) (string, error)
}

const (
	ProviderLocal  = "local"
	ProviderAliOSS = "alioss"
	ProviderQiniu = "qiniu"
	ProviderS3    = "s3"
)

var (
	mu             sync.RWMutex
	current        Provider
	currentKind    string
	currentConfig  string
)

// Get 返回当前激活的存储后端；配置项（provider 或任一参数）变化时自动重建。
func Get() (Provider, error) {
	kind := strings.TrimSpace(common.OptionMap["StorageProvider"])
	if kind == "" {
		kind = ProviderLocal
	}
	cfg := configFingerprint(kind)

	mu.RLock()
	ok := current != nil && currentKind == kind && currentConfig == cfg
	p := current
	mu.RUnlock()
	if ok {
		return p, nil
	}

	mu.Lock()
	defer mu.Unlock()
	if current != nil && currentKind == kind && currentConfig == cfg {
		return current, nil
	}
	current = build(kind)
	currentKind = kind
	currentConfig = cfg
	return current, nil
}

// configFingerprint 汇总该 provider 用到的所有配置项，任一变化都触发重建。
func configFingerprint(kind string) string {
	keys := []string{"StorageLocalDir", "StorageLocalBaseURL"}
	switch kind {
	case ProviderAliOSS:
		keys = []string{"StorageAliOSSBucket", "StorageAliOSSEndpoint", "StorageAliOSSAccessKey", "StorageAliOSSSecret", "StorageAliOSSDomain"}
	case ProviderQiniu:
		keys = []string{"StorageQiniuBucket", "StorageQiniuAccessKey", "StorageQiniuSecretKey", "StorageQiniuDomain", "StorageQiniuRegion"}
	case ProviderS3:
		keys = []string{"StorageS3Bucket", "StorageS3Endpoint", "StorageS3Region", "StorageS3AccessKey", "StorageS3Secret", "StorageS3Domain"}
	}
	parts := make([]string, 0, len(keys)+1)
	parts = append(parts, kind)
	for _, k := range keys {
		parts = append(parts, common.OptionMap[k])
	}
	return strings.Join(parts, "\x00")
}

func build(kind string) Provider {
	switch kind {
	case ProviderAliOSS:
		return NewAliOSS()
	case ProviderQiniu:
		return NewQiniu()
	case ProviderS3:
		return NewS3()
	default:
		return NewLocal()
	}
}

// opt 读取存储配置项，为空时返回默认值。
func opt(key, def string) string {
	v := strings.TrimSpace(common.OptionMap[key])
	if v == "" {
		return def
	}
	return v
}
