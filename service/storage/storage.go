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
	ProviderQiniu  = "qiniu"
	ProviderS3     = "s3"
)

// 配置键前缀：国内主存储用 ""（StorageXxx），海外镜像用 "Overseas"（StorageOverseasXxx）。
const (
	PrefixDomestic = ""
	PrefixOverseas = "Overseas"
)

var (
	mu sync.RWMutex
	// 国内主存储缓存
	current       Provider
	currentKind   string
	currentConfig string
	// 海外镜像存储缓存
	overseasMu     sync.RWMutex
	overseasCur    Provider
	overseasKind   string
	overseasConfig string
)

// Get 返回国内主存储；provider 或任一配置项变化时自动重建。
func Get() (Provider, error) {
	kind := strings.TrimSpace(common.OptionMap["StorageProvider"])
	if kind == "" {
		kind = ProviderLocal
	}
	cfg := configFingerprint(kind, PrefixDomestic)

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
	current = build(kind, PrefixDomestic)
	currentKind = kind
	currentConfig = cfg
	return current, nil
}

// GetOverseas 返回海外镜像存储。未开通（StorageOverseasEnabled != "true"）返回 (nil, false)。
func GetOverseas() (Provider, bool) {
	if strings.TrimSpace(common.OptionMap["StorageOverseasEnabled"]) != "true" {
		return nil, false
	}
	kind := strings.TrimSpace(common.OptionMap["StorageOverseasProvider"])
	if kind == "" {
		kind = ProviderS3
	}
	cfg := configFingerprint(kind, PrefixOverseas)

	overseasMu.RLock()
	ok := overseasCur != nil && overseasKind == kind && overseasConfig == cfg
	p := overseasCur
	overseasMu.RUnlock()
	if ok {
		return p, true
	}

	overseasMu.Lock()
	defer overseasMu.Unlock()
	if overseasCur != nil && overseasKind == kind && overseasConfig == cfg {
		return overseasCur, true
	}
	overseasCur = build(kind, PrefixOverseas)
	overseasKind = kind
	overseasConfig = cfg
	return overseasCur, true
}

func build(kind, prefix string) Provider {
	switch kind {
	case ProviderAliOSS:
		return NewAliOSS(prefix)
	case ProviderQiniu:
		return NewQiniu(prefix)
	case ProviderS3:
		return NewS3(prefix)
	default:
		return NewLocal(prefix)
	}
}

// configFingerprint 汇总该 provider 用到的所有配置项，任一变化都触发重建。
func configFingerprint(kind, prefix string) string {
	var keys []string
	switch kind {
	case ProviderAliOSS:
		keys = []string{"AliOSSBucket", "AliOSSEndpoint", "AliOSSAccessKey", "AliOSSSecret", "AliOSSDomain"}
	case ProviderQiniu:
		keys = []string{"QiniuBucket", "QiniuAccessKey", "QiniuSecretKey", "QiniuDomain", "QiniuRegion"}
	case ProviderS3:
		keys = []string{"S3Bucket", "S3Endpoint", "S3Region", "S3AccessKey", "S3Secret", "S3Domain"}
	default:
		keys = []string{"LocalDir", "LocalBaseURL"}
	}
	parts := make([]string, 0, len(keys)+2)
	parts = append(parts, kind, prefix)
	for _, k := range keys {
		parts = append(parts, common.OptionMap["Storage"+prefix+k])
	}
	return strings.Join(parts, "\x00")
}

// opt 读取存储配置项，为空时返回默认值。
func opt(key, def string) string {
	v := strings.TrimSpace(common.OptionMap[key])
	if v == "" {
		return def
	}
	return v
}

// PublicConfig 公开给前端的双存储配置（不含任何密钥）。
type PublicConfig struct {
	OverseasEnabled bool   `json:"overseas_enabled"`
	CNBase          string `json:"cn_base"`       // 国内公开基址，如 https://cdn.example.com 或 /storage/static
	OverseasBase    string `json:"overseas_base"` // 海外公开基址；未配置域名时为空
}

// GetPublicConfig 汇总国内外公开访问基址，供前端按用户地域解析图片 URL。
func GetPublicConfig() PublicConfig {
	cnKind := strings.TrimSpace(common.OptionMap["StorageProvider"])
	if cnKind == "" {
		cnKind = ProviderLocal
	}
	cfg := PublicConfig{
		CNBase: strings.TrimRight(publicBase(cnKind, PrefixDomestic), "/"),
	}
	if strings.TrimSpace(common.OptionMap["StorageOverseasEnabled"]) == "true" {
		osKind := strings.TrimSpace(common.OptionMap["StorageOverseasProvider"])
		if osKind == "" {
			osKind = ProviderS3
		}
		base := strings.TrimRight(publicBase(osKind, PrefixOverseas), "/")
		// 海外没配公开域名就无法镜像访问，此时视为未开通，前端统一走国内地址
		if base != "" {
			cfg.OverseasEnabled = true
			cfg.OverseasBase = base
		}
	}
	return cfg
}

// publicBase 返回某 provider 的公开访问基址。
func publicBase(kind, prefix string) string {
	switch kind {
	case ProviderAliOSS:
		return opt("Storage"+prefix+"AliOSSDomain", "")
	case ProviderQiniu:
		return opt("Storage"+prefix+"QiniuDomain", "")
	case ProviderS3:
		return opt("Storage"+prefix+"S3Domain", "")
	default:
		return opt("Storage"+prefix+"LocalBaseURL", "/storage/static")
	}
}

// ParseKeyFromURL 从公开访问 URL 反解出存储中的相对 key。
// 用于「存量文件补打水印」这类需要回读原文件的场景：只有指向我们自己
// 存储的文件才认领，外链一律返回 false，避免误抓他人资源。
func ParseKeyFromURL(raw string) (string, bool) {
	u := strings.TrimSpace(raw)
	if u == "" {
		return "", false
	}
	// 历史数据里可能残留 Windows 反斜杠路径（旧版本地存储拼接 bug 的产物），
	// 先归一化成 URL 分隔符，否则这些文件永远补不上水印。
	u = strings.ReplaceAll(u, `\`, "/")
	cfg := GetPublicConfig()
	bases := []string{cfg.CNBase}
	if cfg.OverseasEnabled && cfg.OverseasBase != "" {
		bases = append(bases, cfg.OverseasBase)
	}
	for _, b := range bases {
		b = strings.TrimRight(b, "/")
		if b == "" {
			continue
		}
		if strings.HasPrefix(u, b+"/") {
			key := strings.TrimPrefix(u, b+"/")
			key = strings.TrimPrefix(key, "/")
			// 连续斜杠（/storage/static//gallery/...）也一并收敛
			for strings.Contains(key, "//") {
				key = strings.ReplaceAll(key, "//", "/")
			}
			if key != "" {
				return key, true
			}
		}
	}
	return "", false
}

// CurrentKind 返回当前国内主存储类型（local / alioss / qiniu / s3）。
func CurrentKind() string {
	kind := strings.TrimSpace(common.OptionMap["StorageProvider"])
	if kind == "" {
		return ProviderLocal
	}
	return kind
}

// LocalRoot 返回本地存储的根目录，仅在 CurrentKind() == "local" 时有意义。
// 存量补打水印时直接读盘，比绕一圈 HTTP 回源快得多。
func LocalRoot() string {
	root := strings.TrimSpace(common.OptionMap["StorageLocalDir"])
	if root == "" {
		root = "/data/uploads"
	}
	return root
}

// PublicURL 把相对 key 还原成可公开访问的完整地址。
func PublicURL(key string) string {
	base := strings.TrimRight(publicBase(CurrentKind(), PrefixDomestic), "/")
	return base + "/" + strings.TrimPrefix(key, "/")
}
