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

// 画布工作台静态托管的契约：
//
//	· /studio/            -> index.html
//	· /studio/assets/*.js -> 真实文件 + 长缓存
//	· /studio/任意深链     -> 回落 index.html（前端是单页）
//	· 目录不存在           -> 不注册路由，交回主站 SPA
func TestStudioRouter(t *testing.T) {
	gin.SetMode(gin.TestMode)

	dir := t.TempDir()
	if err := os.MkdirAll(filepath.Join(dir, "assets"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "index.html"), []byte("<html>studio</html>"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "assets", "app.js"), []byte("console.log(1)"), 0o644); err != nil {
		t.Fatal(err)
	}
	t.Setenv("CANVAS_STUDIO_DIR", dir)

	engine := gin.New()
	SetStudioRouter(engine)

	get := func(target string) *httptest.ResponseRecorder {
		w := httptest.NewRecorder()
		engine.ServeHTTP(w, httptest.NewRequest(http.MethodGet, target, nil))
		return w
	}

	if w := get("/studio/"); w.Code != http.StatusOK || w.Body.String() != "<html>studio</html>" {
		t.Fatalf("/studio/ 期望 index.html，得到 %d %q", w.Code, w.Body.String())
	}
	if w := get("/studio/assets/app.js"); w.Code != http.StatusOK || w.Body.String() != "console.log(1)" {
		t.Fatalf("静态产物取错：%d %q", w.Code, w.Body.String())
	} else if cc := w.Header().Get("Cache-Control"); cc == "" || cc == "no-cache" {
		t.Fatalf("assets 应长缓存，得到 %q", cc)
	}
	// 深链回落
	if w := get("/studio/canvas?open=1"); w.Code != http.StatusOK || w.Body.String() != "<html>studio</html>" {
		t.Fatalf("深链应回落 index.html，得到 %d %q", w.Code, w.Body.String())
	}
	// 目录穿越不能读到目录外的文件（gin 会先挡成 400，挡不住时由 path.Clean 兜底回落）
	w := get("/studio/../../../../etc/passwd")
	body := w.Body.String()
	if strings.Contains(body, "root:") || strings.Contains(body, "/bin/") {
		t.Fatalf("穿越请求读到了目录外文件：%d %q", w.Code, body)
	}

	// 目录不存在：不注册任何路由
	t.Setenv("CANVAS_STUDIO_DIR", filepath.Join(dir, "not-uploaded-yet"))
	empty := gin.New()
	SetStudioRouter(empty)
	w = httptest.NewRecorder()
	empty.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/studio/", nil))
	if w.Code != http.StatusNotFound {
		t.Fatalf("产物未上传时不应注册路由，得到 %d", w.Code)
	}
}
