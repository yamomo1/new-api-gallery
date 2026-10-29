#!/usr/bin/env bash
#
# new-api 二开 生产升级脚本
# ------------------------------------------------------------------
# 适配布局：本仓库自带的 deploy/docker-compose.yml
#   new-api（本仓库镜像，3000）+ postgres（数据在命名卷 pg_data）+ redis
#   数据挂载：deploy/data -> /data   deploy/logs -> /app/logs
#   配置来源：deploy/.env（含 SESSION_SECRET / CRYPT_KEY / 库口令）
#
# 用法：
#   ./deploy/upgrade.sh              正常升级（备份 -> 拉码 -> 重建 -> 探活）
#   ./deploy/upgrade.sh --check      只体检，不改任何东西
#   SKIP_GIT=1 ./deploy/upgrade.sh   代码已手动上传，跳过 git pull
#   SKIP_DB_BACKUP=1 ./deploy/upgrade.sh   跳过 pg_dump（已有其它备份策略时）
#
# 本脚本的设计约束：
#   · 全程没有任何 rm / find -delete / git clean。删除类操作一律没有。
#   · 备份只增不减，由你自己决定什么时候清。
#   · 工作树不干净就不拉代码，避免把未提交改动和远端混在一起。
#   · 探活失败自动把镜像换回上一版并重启。
#
# 与 update.sh 的区别：
#   update.sh 适配「数据在 /opt/new-api-gallery/data、单容器 SQLite」的布局；
#   你这台机器是 compose 三容器 + PostgreSQL，用本脚本，不要用 update.sh。
# ------------------------------------------------------------------

set -euo pipefail

SCRIPT_VER="2026-10-29.1-compose"

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$DIR/.." && pwd)"
BACKUP_DIR="$DIR/backups"
ENV_FILE="$DIR/.env"
COMPOSE_FILE="$DIR/docker-compose.yml"
IMAGE="new-api-gallery"
SERVICE="new-api"
PG_SERVICE="postgres"
BRANCH="${BRANCH:-gallery-fork}"
APP_PORT="${APP_PORT:-3000}"
SKIP_GIT="${SKIP_GIT:-0}"
SKIP_DB_BACKUP="${SKIP_DB_BACKUP:-0}"
STAMP="$(date +%Y%m%d-%H%M%S)"

info() { printf '\033[36m[upgrade]\033[0m %s\n' "$*"; }
warn() { printf '\033[33m[warn]\033[0m %s\n' "$*"; }
fail() { printf '\033[31m[fail]\033[0m %s\n' "$*" >&2; exit 1; }

# ---------- 探活 ----------
# 优先容器内 wget（镜像自带），其次宿主机 3000 端口（compose 已发布 3000:3000）
probe() {
  local i
  for i in $(seq 1 40); do
    if docker compose -f "$COMPOSE_FILE" exec -T "$SERVICE" \
         wget -qO- --timeout=2 "http://127.0.0.1:${APP_PORT}/api/status" 2>/dev/null \
         | grep -q '"success":true'; then
      return 0
    fi
    if curl -fsS --max-time 2 "http://127.0.0.1:${APP_PORT}/api/status" 2>/dev/null \
         | grep -q '"success":true'; then
      return 0
    fi
    sleep 2
  done
  return 1
}

# ---------- 体检 ----------
check_env() {
  info "环境体检"
  info "  脚本版本：$SCRIPT_VER"
  info "  仓库目录：$REPO"
  info "  编排文件：$COMPOSE_FILE"
  info "  配置文件：$ENV_FILE"
  info "  备份目录：$BACKUP_DIR"

  [[ -d "$REPO/.git" ]]      || fail "不是 git 仓库：$REPO"
  [[ -f "$COMPOSE_FILE" ]]   || fail "找不到编排文件：$COMPOSE_FILE"
  [[ -f "$ENV_FILE" ]]       || fail "找不到 $ENV_FILE
       → 这个文件存着 SESSION_SECRET 和数据库口令，丢了会导致全员掉线、连不上库
       → 如果你确实没有它，说明不是用 deploy/deploy.sh 部署的，别继续，先跑 ./deploy/diagnose.sh"
  docker compose version >/dev/null 2>&1 || fail "找不到 docker compose"

  if grep -q "CHANGE_ME" "$ENV_FILE" 2>/dev/null; then
    warn "  .env 里还有 CHANGE_ME 占位值，请先改成真实值"
  fi

  info "  当前镜像：${IMAGE}:latest $(docker image inspect --format '{{.Created}}' "${IMAGE}:latest" 2>/dev/null || echo '（无）')"
  info "  仓库 HEAD：$(git -C "$REPO" rev-parse --short HEAD 2>/dev/null || echo '?')（分支 $(git -C "$REPO" branch --show-current 2>/dev/null || echo '?')）"

  local dirty
  dirty="$(git -C "$REPO" status --porcelain 2>/dev/null | head -5 || true)"
  if [[ -n "$dirty" ]]; then
    warn "  工作树有未提交改动："
    printf '%s\n' "$dirty" | sed 's/^/        /'
  else
    info "  工作树：干净"
  fi

  local ip
  ip="$(docker inspect "$IMAGE" --format '{{range .NetworkSettings.Networks}}{{.IPAddress}} {{end}}' 2>/dev/null | awk '{print $1}' || true)"
  if [[ -n "$ip" ]]; then
    info "  容器 IP：$ip（如果 1Panel 反代写的是容器 IP，重建后可能要改）"
  fi
}

if [[ "${1:-}" == "--check" ]]; then
  check_env
  exit 0
fi

[[ "${1:-}" == "" ]] || fail "未知参数：$1（可用：--check）"

check_env

# ---------- 1. 检查工作树，脏就不拉码 ----------
if [[ "$SKIP_GIT" != "1" ]]; then
  if [[ -n "$(git -C "$REPO" status --porcelain 2>/dev/null || true)" ]]; then
    fail "工作树不干净，拒绝 git pull
       → 先看清楚改了什么： cd $REPO && git status --short
       → 如果是文件被误删（行首 D）： git ls-files -d -z | xargs -0 -r git checkout --
       → 如果确实是我不想要这些改动了：先 git stash 收起来（可随时 git stash pop 找回）
       → 或者 SKIP_GIT=1 $0 跳过拉码，只用当前代码重建"
  fi
fi

# ---------- 2. 备份 .env ----------
info "步骤 1/5 备份 deploy/.env"
mkdir -p "$BACKUP_DIR"
cp -a "$ENV_FILE" "$BACKUP_DIR/env.$STAMP"
chmod 600 "$BACKUP_DIR/env.$STAMP"
info "  -> $BACKUP_DIR/env.$STAMP"

# ---------- 3. 备份数据库（pg_dump） ----------
info "步骤 2/5 备份 PostgreSQL"
if [[ "$SKIP_DB_BACKUP" == "1" ]]; then
  warn "  SKIP_DB_BACKUP=1，跳过"
elif ! docker compose -f "$COMPOSE_FILE" ps "$PG_SERVICE" 2>/dev/null | grep -q "Up"; then
  warn "  $PG_SERVICE 容器没在运行，跳过 pg_dump（确认你有其它备份策略）"
else
  DUMP="$BACKUP_DIR/pg-$STAMP.sql"
  # 2>&1 >file：stderr 进变量（失败时打印），stdout 进 dump 文件
  if ERR="$(docker compose -f "$COMPOSE_FILE" exec -T "$PG_SERVICE" \
              pg_dump -U root -d new-api 2>&1 >"$DUMP")"; then
    info "  -> $DUMP ($(du -h "$DUMP" | cut -f1))"
  else
    warn "  pg_dump 失败：${ERR:-无输出}"
    warn "  数据库没备份成功。要继续请显式： SKIP_DB_BACKUP=1 $0"
    exit 1
  fi
fi

# ---------- 4. 记录回滚点 + 拉代码 ----------
info "步骤 3/5 记录回滚点"
if docker image inspect "${IMAGE}:latest" >/dev/null 2>&1; then
  docker tag "${IMAGE}:latest" "${IMAGE}:previous"
  info "  当前镜像已标记为 ${IMAGE}:previous"
else
  warn "  没有 ${IMAGE}:latest，本次无法自动回滚"
fi

info "步骤 4/5 更新代码"
if [[ "$SKIP_GIT" == "1" ]]; then
  info "  SKIP_GIT=1，跳过 git pull"
else
  git -C "$REPO" pull --ff-only origin "$BRANCH" || fail "git pull 失败，请手动处理： cd $REPO && git status"
  info "  HEAD -> $(git -C "$REPO" rev-parse --short HEAD)"
fi

# ---------- 5. 重建并启动 ----------
info "步骤 5/5 重建镜像并启动（这一步最慢，前端要重新打包）"
if ! docker compose -f "$COMPOSE_FILE" up -d --build; then
  warn "构建或启动失败，线上仍是旧容器（compose 失败时不会替换）"
  docker compose -f "$COMPOSE_FILE" logs --tail=30 "$SERVICE" 2>/dev/null || true
  exit 1
fi

info "探活 http://127.0.0.1:${APP_PORT}/api/status ..."
if probe; then
  NEW_IP="$(docker inspect "$IMAGE" --format '{{range .NetworkSettings.Networks}}{{.IPAddress}} {{end}}' 2>/dev/null | awk '{print $1}' || true)"
  echo
  info "升级完成，HEAD=$(git -C "$REPO" rev-parse --short HEAD)"
  info "容器 IP：${NEW_IP:-未知}"
  [[ -n "${NEW_IP:-}" ]] && info "若 1Panel 反代写的是容器 IP，请确认就是上面这个；不一致就改反代地址"
  info "回滚命令（如需）： docker tag ${IMAGE}:previous ${IMAGE}:latest && docker compose -f $COMPOSE_FILE up -d --force-recreate $SERVICE"
else
  warn "探活 80 秒内未通过，自动回滚到上一版"
  docker compose -f "$COMPOSE_FILE" logs --tail=40 "$SERVICE" 2>/dev/null || true
  if docker image inspect "${IMAGE}:previous" >/dev/null 2>&1; then
    docker tag "${IMAGE}:previous" "${IMAGE}:latest"
    docker compose -f "$COMPOSE_FILE" up -d --force-recreate "$SERVICE"
    if probe; then
      warn "已回滚，服务恢复正常。请把上面的日志发出来排查新版本问题"
    else
      fail "回滚后仍然探活失败，请人工介入： docker compose -f $COMPOSE_FILE logs --tail=100 $SERVICE"
    fi
  else
    fail "没有可用的回滚镜像，请人工介入"
  fi
  exit 1
fi
