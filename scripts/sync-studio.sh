#!/usr/bin/env bash
#
# 把画布（infinite-canvas）的前端产物同步进本仓库的 studio/dist/，
# 之后 go build 会通过 go:embed 把它编进二进制 —— 于是「升级 new-api」就等于「升级画布」。
#
# 这是**本地开发用**脚本：服务器上只有 new-api 仓库，不需要它。
#
# 用法：
#   ./scripts/sync-studio.sh                         # 默认读 ../infinite-canvas
#   ./scripts/sync-studio.sh /path/to/infinite-canvas
#   CANVAS_DIR=/path/to/infinite-canvas ./scripts/sync-studio.sh
#   SKIP_BUILD=1 ./scripts/sync-studio.sh            # 直接用现成的 web/dist（要求 base 已是 /studio/）
#
# 约定：
#   · 只写 studio/dist，不碰其它任何目录；该目录内容进 git。
#   · 构建走画布仓库的 `bun run build:studio`（= vite build --base=/studio/）。
#   · 同步完不会自动 commit，只打印变更摘要，由你确认后自己提交。
#
set -euo pipefail

SCRIPT_VER="1"

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CANVAS="${1:-${CANVAS_DIR:-$REPO/../infinite-canvas}}"
DEST="$REPO/studio/dist"

info() { printf '[studio] %s\n' "$*"; }
warn() { printf '[studio] %s\n' "$*" >&2; }
fail() { printf '[studio] 失败: %s\n' "$*" >&2; exit 1; }

# ---------- 1. 定位画布仓库 ----------
[[ -d "$CANVAS" ]] || fail "找不到画布仓库：$CANVAS
       用参数指定： ./scripts/sync-studio.sh /path/to/infinite-canvas"
CANVAS="$(cd "$CANVAS" && pwd)"
[[ -f "$CANVAS/web/package.json" ]] || fail "$CANVAS 看起来不是 infinite-canvas（缺 web/package.json）"

# 目标目录守卫：只允许写本仓库下的 studio/dist
[[ "$DEST" == "$REPO/studio/dist" ]] || fail "目标路径异常：$DEST"

# ---------- 2. 构建 ----------
SRC="$CANVAS/web/dist"
if [[ "${SKIP_BUILD:-0}" == "1" ]]; then
  info "SKIP_BUILD=1，直接复用 $SRC"
  [[ -f "$SRC/index.html" ]] || fail "$SRC/index.html 不存在，先跑一次不带 SKIP_BUILD 的"
else
  grep -q '"build:studio"' "$CANVAS/web/package.json" \
    || fail "画布仓库的 web/package.json 里没有 build:studio 脚本（先把画布仓库更新到最新）"
  [[ -d "$CANVAS/web/node_modules" ]] || fail "$CANVAS/web/node_modules 不存在，先在画布仓库跑 bun install"

  BUN="$(command -v bun 2>/dev/null || true)"
  if [[ -z "$BUN" ]]; then
    for c in "$HOME/.bun/bin/bun" "$HOME/.bun/bin/bun.exe"; do
      [[ -x "$c" ]] && { BUN="$c"; break; }
    done
  fi
  [[ -n "$BUN" ]] || fail "找不到 bun（画布依赖用 bun 安装，npm 装不动）"

  info "构建画布产物（base=/studio/）…"
  # MSYS_*：Git Bash 会把 --base=/studio/ 里的 /studio/ 当成 Windows 路径转换掉，
  # 转坏了产物里的资源 URL 全是错的（白屏）。带 = 号一般不会被转，这里再兜一层。
  ( cd "$CANVAS/web" && MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL='*' "$BUN" run build:studio ) \
    || fail "画布构建失败"
fi

# ---------- 3. 校验产物 ----------
[[ -f "$SRC/index.html" ]] || fail "构建完没有 $SRC/index.html"
grep -q '"/studio/assets/' "$SRC/index.html" \
  || fail "产物 base 前缀不对（入口里没有 /studio/assets/），装到 /studio 下必然白屏
       检查画布仓库是否用 --base=/studio/ 构建（build:studio 脚本）"

# ---------- 4. 同步（只动 studio/dist） ----------
mkdir -p "$DEST"
find "$DEST" -mindepth 1 -delete
cp -a "$SRC/." "$DEST/"

# ---------- 5. 写 build-info.json（升级后用它核对线上是哪一版画布） ----------
C_COMMIT="$(git -C "$CANVAS" rev-parse HEAD 2>/dev/null || echo unknown)"
C_BRANCH="$(git -C "$CANVAS" rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)"
C_SHORT="${C_COMMIT:0:7}"
C_DIRTY=false
# 只算已跟踪文件的改动：未跟踪的截图/临时文件不会影响构建产物
if [[ -n "$(git -C "$CANVAS" status --porcelain --untracked-files=no 2>/dev/null || true)" ]]; then
  C_DIRTY=true
fi
FILE_NUM="$(find "$DEST" -type f | wc -l | tr -d ' ')"
NOW="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

cat > "$DEST/build-info.json" <<EOF
{
  "version": "$C_SHORT",
  "commit": "$C_COMMIT",
  "branch": "$C_BRANCH",
  "builtAt": "$NOW",
  "dirty": $C_DIRTY,
  "files": $FILE_NUM,
  "syncedBy": "sync-studio.sh/$SCRIPT_VER"
}
EOF

info "已同步 $FILE_NUM 个文件到 studio/dist（$(du -sh "$DEST" | cut -f1)）"
info "  画布版本：$C_SHORT（$C_BRANCH）@ $NOW"
if [[ "$C_DIRTY" == "true" ]]; then
  warn "  注意：画布仓库有未提交改动，这个版本号代表不了内容。正式发版前先在画布仓库提交。"
fi

# ---------- 6. 变更摘要 ----------
printf '\n'
if git -C "$REPO" rev-parse --git-dir >/dev/null 2>&1; then
  changed="$(git -C "$REPO" status --porcelain studio/ | head -20 || true)"
  if [[ -z "$changed" ]]; then
    info "studio/dist 与已提交内容一致，无需提交"
  else
    info "studio/dist 有变更，确认无误后在本仓库提交："
    printf '%s\n' "$changed" | sed 's/^/        /'
    printf '\n'
    info "  git add studio/ && git commit -m \"chore(studio): 同步画布 $C_SHORT\""
  fi
fi
