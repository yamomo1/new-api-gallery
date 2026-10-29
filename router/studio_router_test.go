package router

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

func newStudioEngine(t *testing.T) *gin.Engine {
	t.Helper()
	gin.SetMode(gin.TestMode)
	e := gin.New()
	SetStudioRouter(e)
	return e
}

func doGet(e *gin.Engine, target string, headers map[string]string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodGet, target, nil)
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	w := httptest.NewRecorder()
	e.ServeHTTP(w, req)
	return w
}

// 内置版本：不设 CANVAS_STUDIO_DIR 时，画布产物来自编进二进制的那份。
// 这是「升级 New API 即升级画布」的核心保障，所以断言要硬：
//
//	· /studio/ 必须是 200 且是画布入口
//	· 入口里的资源路径必须带 /studio/ 前缀（漏了 VITE base 就会变 /assets/，装上去必然白屏）
//	· 深链回落、长缓存、ETag/304、目录穿越
func TestStudioRouterEmbedded(t *testing.T) {
	t.Setenv("CANVAS_STUDIO_DIR", "")
	e := newStudioEngine(t)

	w := doGet(e, "/studio/", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("内置画布应可访问，得到 %d", w.Code)
	}
	index := w.Body.String()
	if !strings.Contains(index, `id="root"`) {
		t.Fatalf("/studio/ 不是画布入口：%q", index)
	}
	if !strings.Contains(index, `"/studio/assets/`) {
		t.Fatalf("产物 base 前缀不对（应为 /studio/assets/…，说明构建时没设 base）：%s", index)
	}
	if cc := w.Header().Get("Cache-Control"); cc != "no-cache" {
		t.Fatalf("index.html 应 no-cache，得到 %q", cc)
	}

	// 入口里的主 JS 必须真的能取到，且是 JS 类型 + 长缓存
	mainJS := firstStudioAsset(index)
	if mainJS == "" {
		t.Fatalf("入口里找不到 /studio/assets/*.js：%s", index)
	}
	w = doGet(e, "/studio/"+mainJS, nil)
	if w.Code != http.StatusOK || w.Body.Len() == 0 {
		t.Fatalf("主 JS 取不到：%d len=%d", w.Code, w.Body.Len())
	}
	if ct := w.Header().Get("Content-Type"); !strings.Contains(ct, "javascript") {
		t.Fatalf("主 JS 的 Content-Type 应为 javascript，得到 %q（浏览器会拒绝执行 module）", ct)
	}
	if cc := w.Header().Get("Cache-Control"); !strings.Contains(cc, "immutable") {
		t.Fatalf("assets 应 immutable 长缓存，得到 %q", cc)
	}

	// ETag 命中应 304，避免每次刷新都重传入口
	etag := doGet(e, "/studio/", nil).Header().Get("ETag")
	if etag == "" {
		t.Fatal("响应应带 ETag")
	}
	if w := doGet(e, "/studio/", map[string]string{"If-None-Match": etag}); w.Code != http.StatusNotModified {
		t.Fatalf("ETag 命中应 304，得到 %d", w.Code)
	}

	// 深链回落（画布用 /studio/canvas?open=3 打开指定画布）
	if w := doGet(e, "/studio/canvas?open=3", nil); w.Code != http.StatusOK || !strings.Contains(w.Body.String(), `id="root"`) {
		t.Fatalf("深链应回落画布入口，得到 %d", w.Code)
	}

	// 目录穿越读不到仓库外的文件
	if body := doGet(e, "/studio/../../../../etc/passwd", nil).Body.String(); strings.Contains(body, "root:") {
		t.Fatal("穿越请求读到了目录外文件")
	}

	// build-info.json（同步脚本生成）应可访问，供升级脚本核对版本
	if w := doGet(e, "/studio/build-info.json", nil); w.Code == http.StatusOK {
		if !strings.Contains(w.Body.String(), "builtAt") {
			t.Fatalf("build-info.json 内容异常：%s", w.Body.String())
		}
	}
}

// 磁盘覆盖：显式设 CANVAS_STUDIO_DIR 时优先用磁盘目录（临时换包不重建镜像）
func TestStudioRouterDirOverride(t *testing.T) {
	dir := t.TempDir()
	if err := os.MkdirAll(filepath.Join(dir, "assets"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "index.html"), []byte("<html>studio-dir</html>"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "assets", "app.js"), []byte("console.log(1)"), 0o644); err != nil {
		t.Fatal(err)
	}
	t.Setenv("CANVAS_STUDIO_DIR", dir)
	e := newStudioEngine(t)

	if w := doGet(e, "/studio/", nil); w.Code != http.StatusOK || w.Body.String() != "<html>studio-dir</html>" {
		t.Fatalf("磁盘版应优先生效，得到 %d %q", w.Code, w.Body.String())
	}
	if w := doGet(e, "/studio/assets/app.js", nil); w.Code != http.StatusOK || w.Body.String() != "console.log(1)" {
		t.Fatalf("静态产物取错：%d %q", w.Code, w.Body.String())
	}
}

// 设了目录但目录不存在：应回退到内置版本，而不是整个 /studio 消失
func TestStudioRouterFallbackToEmbedded(t *testing.T) {
	t.Setenv("CANVAS_STUDIO_DIR", filepath.Join(t.TempDir(), "not-exist"))
	e := newStudioEngine(t)
	if w := doGet(e, "/studio/", nil); w.Code != http.StatusOK || !strings.Contains(w.Body.String(), `id="root"`) {
		t.Fatalf("目录不存在时应回退内置版本，得到 %d", w.Code)
	}
}

// 未设置任何来源且构建里没有画布时才不注册路由。这里无法真的删掉 embed，
// 所以只验证「不设环境变量不会 404」这一侧。
func TestStudioRouterAlwaysRegisteredWhenEmbedded(t *testing.T) {
	t.Setenv("CANVAS_STUDIO_DIR", "")
	e := newStudioEngine(t)
	if w := doGet(e, "/studio", nil); w.Code != http.StatusFound {
		t.Fatalf("/studio 应 302 到 /studio/，得到 %d", w.Code)
	}
}

// firstStudioAsset 从入口 HTML 里取出第一个 /studio/assets/*.js 的路径
// （返回时去掉 /studio/ 前缀，便于直接拼请求；入口里 logo.svg 之类的要先跳过）
func firstStudioAsset(s string) string {
	const marker = `"/studio/`
	for {
		i := strings.Index(s, marker)
		if i < 0 {
			return ""
		}
		s = s[i+len(marker):]
		end := strings.Index(s, `"`)
		if end < 0 {
			return ""
		}
		p := s[:end]
		if strings.HasPrefix(p, "assets/") && strings.HasSuffix(p, ".js") {
			return p
		}
		s = s[end:]
	}
}
