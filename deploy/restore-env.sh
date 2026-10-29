#!/usr/bin/env bash
# ==================================================================
# restore-env.sh —— 只干一件事：把 deploy/.env 找回来
#
# 什么时候用：
#   ./deploy/upgrade.sh 体检时报
#     [fail] 找不到 /opt/.../deploy/.env
#
# 找回来源（按顺序尝试，取到就停）：
#   1) deploy/backups/env.*  —— upgrade.sh 每次升级前自己备份的原文件（最准，优先）
#   2) 正在运行的容器的环境变量 —— docker inspect 拿到的就是当前生效的配置
#      （容器在跑说明这套配置是对的；SESSION_SECRET 一致就不会把用户踢下线）
#
# 安全约定：
#   · 全程不删除、不覆盖任何已有文件：deploy/.env 已存在 → 直接退出
#   · 写入前先打印「来源 + 键名清单」（只打键名，不打密钥值）
#   · 写出的文件权限 600
#   · 只写 deploy/.env 这一个文件
#
# 用法：
#   ./deploy/restore-env.sh            # 执行找回
#   ./deploy/restore-env.sh --dry-run  # 只看会从哪恢复，不动文件
# ==================================================================

set -euo pipefail

SCRIPT_VER="2026-10-29.1"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$DIR/.." && pwd)"
ENV_FILE="$DIR/.env"
BACKUP_DIR="$DIR/backups"
CONTAINER="new-api-gallery"
COMPOSE_FILE="$DIR/docker-compose.yml"
DRY=0
[[ "${1:-}" == "--dry-run" ]] && DRY=1

info() { printf '[restore] %s\n' "$*"; }
warn() { printf '[warn] %s\n' "$*"; }
fail() { printf '[fail] %s\n' "$*" >&2; exit 1; }

info "脚本版本：$SCRIPT_VER"
info "仓库目录：$REPO"

# ---------- 0. 已经存在就别动 ----------
if [[ -f "$ENV_FILE" ]]; then
  info "deploy/.env 已存在（$(stat -c '%s bytes, mtime %y' "$ENV_FILE" 2>/dev/null || echo '?')）"
  info "不需要恢复。直接跑： ./deploy/upgrade.sh"
  exit 0
fi
warn "deploy/.env 不存在，开始找回"

# ---------- 1. 顺带报一下邻居文件还在不在（判断是不是被整目录清过） ----------
for d in data logs backups; do
  if [[ -d "$DIR/$d" ]]; then
    info "  邻居 deploy/$d ：存在（$(find "$DIR/$d" -maxdepth 1 -mindepth 1 2>/dev/null | wc -l | tr -d ' ') 个条目）"
  else
    warn "  邻居 deploy/$d ：不存在 ← 若 data 也没了，先别继续，把情况发我"
  fi
done

SRC=""
SRC_KIND=""

# ---------- 2. 优先用 upgrade.sh 的备份（find 限目录限类型，不用 glob，不会误伤） ----------
if [[ -d "$BACKUP_DIR" ]]; then
  SRC="$(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'env.*' -printf '%T@\t%p\n' 2>/dev/null \
        | sort -rn | head -1 | cut -f2- || true)"
fi

if [[ -n "$SRC" && -f "$SRC" ]]; then
  SRC_KIND="upgrade.sh 的备份"
  info "找到备份：$SRC"
  info "  备份时间：$(stat -c '%y' "$SRC" 2>/dev/null || echo '?')"
else
  # ---------- 3. 退而求其次：从正在运行的容器取 ----------
  warn "没有 deploy/backups/env.* 备份，改从运行中的容器取当前生效配置"
  if ! docker inspect "$CONTAINER" >/dev/null 2>&1; then
    fail "容器 $CONTAINER 也不在，两条路都断了
       → 别急着重装：先在服务器上搜一下有没有别处的备份
         find / -maxdepth 6 -type f -name '.env' -path '*new-api*' 2>/dev/null
       → 或看 1Panel 里这个站点/编排的「环境变量」配置页（可能存在面板数据库里）"
  fi
  SRC="$(mktemp /tmp/newapi-env-from-container.XXXXXX)"
  docker inspect "$CONTAINER" --format '{{range .Config.Env}}{{println .}}{{end}}' \
    | grep -vE '^(PATH|HOSTNAME|HOME|PWD|SHLVL|TERM|_|LD_LIBRARY_PATH)=' > "$SRC"
  SRC_KIND="运行中容器的环境变量（docker inspect）"
  info "已导出到：$SRC"
fi

[[ -s "$SRC" ]] || fail "来源文件是空的，无法恢复：$SRC"

# ---------- 4. 打印键名清单（只打名字，不打值） ----------
KEYCOUNT="$(grep -cE '^[A-Za-z_][A-Za-z0-9_]*=' "$SRC" 2>/dev/null || echo 0)"
info "  有效配置项：${KEYCOUNT} 条"
info "  键名清单："
grep -oE '^[A-Za-z_][A-Za-z0-9_]*=' "$SRC" 2>/dev/null | tr -d '=' | sed 's/^/        /'

for k in SESSION_SECRET CRYPT_KEY SQL_DSN; do
  if grep -qE "^${k}=" "$SRC"; then
    info "  ✓ 含 $k"
  else
    warn "  ！不含 $k —— 恢复后注意这一项（缺 SESSION_SECRET 会让所有人重新登录）"
  fi
done

if [[ "$DRY" == "1" ]]; then
  printf '\n（--dry-run：到此为止，未写入任何文件）\n'
  exit 0
fi

# ---------- 5. 写入 ----------
cp -a -- "$SRC" "$ENV_FILE"
chmod 600 "$ENV_FILE"
info "已写入：$ENV_FILE（来源：$SRC_KIND，权限 600，$(stat -c '%s' "$ENV_FILE") bytes）"

# ---------- 6. 让 compose 校验一遍能不能解析 ----------
if docker compose -f "$COMPOSE_FILE" config -q >/dev/null 2>&1; then
  info "compose 校验通过（编排能正常读到这些变量）"
else
  warn "compose 校验没过：docker compose -f $COMPOSE_FILE config 看具体报错"
  warn "（多半是 .env 里某行格式问题，比如值里有未转义的空格/引号）"
fi

printf '\n下一步： ./deploy/upgrade.sh\n'
info "起来后核对一下反代： docker inspect $CONTAINER --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}'"
