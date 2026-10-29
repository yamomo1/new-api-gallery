#!/usr/bin/env bash
#
# new-api 二开版 一键更新脚本
# ------------------------------------------------------------------
# 做六件事：备份数据库 -> 记录回滚点 -> 拉代码 -> 构建镜像 -> 重启 -> 健康检查
# 健康检查失败会自动回滚到上一个镜像。
#
# 目录约定（与本仓库 deploy/docker-compose.host.yml 一致）：
#   /opt/new-api-gallery/                   项目根 BASE_DIR
#   ├── new-api-gallery/                    git 仓库 APP_DIR（本脚本所在仓库）
#   ├── data/                               SQLite 数据
#   ├── logs/                               日志
#   ├── backups/                            备份
#   └── docker-compose.yml                  运行时编排
#
# 用法（在服务器上）：
#   /opt/new-api-gallery/new-api-gallery/deploy/update.sh            正常更新
#   /opt/new-api-gallery/new-api-gallery/deploy/update.sh --rollback 手动回滚到上一版
#   SKIP_GIT=1 ./deploy/update.sh            代码已手动上传，跳过 git pull
#   ./deploy/update.sh --check               只做环境体检，不改任何东西
#
# 可用环境变量覆盖（一般不改）：
#   APP_DIR        代码目录，默认 /opt/new-api-gallery/new-api-gallery
#   BASE_DIR       项目根，默认 APP_DIR 的上一级 = /opt/new-api-gallery
#   DATA_DIR       数据目录，默认 $BASE_DIR/data
#   BACKUP_DIR     备份目录，默认 $BASE_DIR/backups
#   COMPOSE_FILE   编排文件，默认 $BASE_DIR/docker-compose.yml
#   IMAGE          镜像名，默认 new-api-gallery
#   BRANCH         分支，默认 gallery-fork
#   SERVICE        编排里的服务名，默认 new-api
#   HEALTH_URL     健康检查地址，默认 http://127.0.0.1:3000/api/status（仅无容器ID时的兜底）
#   APP_PORT       容器内服务端口，默认 3000（探活优先在容器内 wget 这个端口）
#   REGISTRY       构建时的镜像加速器，默认读 Dockerfile.cn 里的值
#   ALLOW_NO_BACKUP=1  允许在数据目录不存在时继续（仅限新装/已有外部库备份策略时）
#
# 安全约束（不要改）：
#   · 数据目录不存在 -> 直接退出，不做无备份升级
#   · 备份清理只碰 $BACKUP_DIR 下 *.bak 普通文件，且校验真实路径防误删

set -euo pipefail

# 脚本版本：用于确认服务器上跑的到底是不是修复版（事故后排查用）
SCRIPT_VER="2026-10-29.3-fix-prune"

APP_DIR="${APP_DIR:-/opt/new-api-gallery/new-api-gallery}"
BASE_DIR="${BASE_DIR:-$(dirname "$APP_DIR")}"
DATA_DIR="${DATA_DIR:-$BASE_DIR/data}"
BACKUP_DIR="${BACKUP_DIR:-$BASE_DIR/backups}"
COMPOSE_FILE="${COMPOSE_FILE:-$BASE_DIR/docker-compose.yml}"
IMAGE="${IMAGE:-new-api-gallery}"
BRANCH="${BRANCH:-gallery-fork}"
SERVICE="${SERVICE:-new-api}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3000/api/status}"
APP_PORT="${APP_PORT:-3000}"
SKIP_GIT="${SKIP_GIT:-0}"
KEEP_BACKUPS="${KEEP_BACKUPS:-10}"

info()  { printf '\033[36m[update]\033[0m %s\n' "$*"; }
warn()  { printf '\033[33m[warn]\033[0m %s\n' "$*"; }
fail()  { printf '\033[31m[fail]\033[0m %s\n' "$*" >&2; exit 1; }

# ---------- compose 命令探测 ----------
if docker compose version >/dev/null 2>&1; then
  DC="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  DC="docker-compose"
else
  fail "找不到 docker compose，请先安装 Docker Compose 插件"
fi

# ---------- 健康探活 ----------
# 容器没有端口映射时 127.0.0.1 是不通的（反代直连容器 IP），所以按三层探：
#   1) 容器内 wget（镜像自带 wget，最可靠，不依赖宿主机网络策略）
#   2) 宿主机访问容器 IP（镜像里没 wget 时）
#   3) HEALTH_URL（有端口映射的传统部署）
probe_health() {
  local cid ip
  cid="$($DC -f "$COMPOSE_FILE" ps -q "$SERVICE" 2>/dev/null | head -1 || true)"
  if [[ -n "$cid" ]]; then
    if docker exec "$cid" wget -qO- --timeout=2 "http://127.0.0.1:${APP_PORT}/api/status" 2>/dev/null | grep -q '"success":true'; then
      return 0
    fi
    ip="$(docker inspect --format '{{range .NetworkSettings.Networks}}{{.IPAddress}} {{end}}' "$cid" 2>/dev/null | awk '{print $1}' || true)"
    if [[ -n "$ip" ]] && curl -fsS --max-time 2 "http://${ip}:${APP_PORT}/api/status" 2>/dev/null | grep -q '"success":true'; then
      return 0
    fi
  fi
  curl -fsS --max-time 2 "$HEALTH_URL" 2>/dev/null | grep -q '"success":true'
}

# ---------- 备份清理（安全实现） ----------
# 这段代码早期版本造成过两次生产事故，实现方式必须极度保守：
#   旧写法 `ls -1t "$BACKUP_DIR"/*.bak | tail -n +11 | xargs rm -f`
#   在 nullglob 打开且备份目录为空时，glob 展开为空 → `ls -1t` 无参数 = 列出【当前目录】
#   （此时 cwd 已是代码目录）→ 删除仓库根目录第 11 项之后的普通文件。
# 此处三重收紧：
#   1) 只认 $BACKUP_DIR 这一层、普通文件、后缀 .bak —— 由 find 硬约束，完全不经过 shell glob
#   2) 动手前校验解析后的真实路径不是 /，不是代码目录，不是项目根
#   3) 逐个 rm -f --，路径带引号，不经 xargs
safe_prune_backups() {
  local real_backup real_app real_base total
  [[ -d "$BACKUP_DIR" ]] || return 0

  real_backup="$(cd "$BACKUP_DIR" 2>/dev/null && pwd -P)" || return 0
  real_app="$(cd "$APP_DIR" 2>/dev/null && pwd -P || true)"
  real_base="$(cd "$BASE_DIR" 2>/dev/null && pwd -P || true)"

  if [[ -z "$real_backup" || "$real_backup" == "/" \
        || "$real_backup" == "$real_app" || "$real_backup" == "$real_base" ]]; then
    warn "  备份目录真实路径异常（${real_backup:-空}），跳过清理以免误删"
    return 0
  fi

  total="$(find "$real_backup" -maxdepth 1 -type f -name '*.bak' 2>/dev/null | wc -l)"
  [[ "$total" -gt "$KEEP_BACKUPS" ]] || return 0

  find "$real_backup" -maxdepth 1 -type f -name '*.bak' -printf '%T@\t%p\n' 2>/dev/null \
    | sort -rn \
    | awk -v K="$KEEP_BACKUPS" 'NR > K { sub(/^[^\t]*\t/, ""); print }' \
    | while IFS= read -r old; do
        [[ -n "$old" ]] && rm -f -- "$old"
      done
  info "  已清理最旧的 $((total - KEEP_BACKUPS)) 份备份（保留最近 $KEEP_BACKUPS 份）"
}

# ---------- 环境体检 ----------
check_env() {
  info "环境体检"
  info "  脚本版本：$SCRIPT_VER"
  info "  代码目录：$APP_DIR"
  info "  项目根  ：$BASE_DIR"
  info "  数据目录：$DATA_DIR"
  info "  备份目录：$BACKUP_DIR"
  info "  编排文件：$COMPOSE_FILE"

  [[ -d "$APP_DIR" ]]        || fail "代码目录不存在：$APP_DIR（git clone 到了别处？用 APP_DIR=... 指定）"
  [[ -f "$COMPOSE_FILE" ]]   || fail "编排文件不存在：$COMPOSE_FILE
       首次部署请先执行：
         cp $APP_DIR/deploy/docker-compose.host.yml $BASE_DIR/docker-compose.yml
       然后把里面的 SESSION_SECRET 改成固定值。"
  # 数据目录缺失 = 备份做不到。脚本的安全前提是"先备份再动手"，所以这里必须停下，
  # 而不是打一行 warn 继续跑（旧行为：告警后照样构建重启，等于无备份升级）。
  if [[ ! -d "$DATA_DIR" ]]; then
    if [[ "${ALLOW_NO_BACKUP:-0}" == "1" ]]; then
      warn "  数据目录不存在：$DATA_DIR —— ALLOW_NO_BACKUP=1，按你要求继续（本次没有数据库备份）"
    else
      fail "数据目录不存在：$DATA_DIR
       → 本次做不了数据库备份，脚本拒绝继续（不允许无备份升级）
       → 按情况选一条：
         a) 新装、还没有任何数据：      ALLOW_NO_BACKUP=1 $0
         b) 数据在别的路径（1Panel 等）：先跑 ./deploy/diagnose.sh 查出容器真实挂载，再 DATA_DIR=/真实路径 $0
         c) 用的是 PostgreSQL/MySQL：   先自行 pg_dump/mysqldump 备份，再 ALLOW_NO_BACKUP=1 $0"
    fi
  fi
  if grep -q "CHANGE_ME" "$COMPOSE_FILE" 2>/dev/null; then
    warn "  编排里 SESSION_SECRET 还是 CHANGE_ME，务必改成固定随机值后再启动"
  fi
  info "  compose ：$DC"
  info "  镜像    ：$IMAGE（当前 latest：$(docker image inspect --format '{{.Created}}' "${IMAGE}:latest" 2>/dev/null || echo '无')）"
}

if [[ "${1:-}" == "--check" ]]; then
  check_env
  exit 0
fi

# ---------- 回滚模式 ----------
if [[ "${1:-}" == "--rollback" ]]; then
  info "回滚模式"
  if ! docker image inspect "${IMAGE}:previous" >/dev/null 2>&1; then
    fail "没有找到 ${IMAGE}:previous，无法回滚"
  fi
  docker tag "${IMAGE}:previous" "${IMAGE}:latest"
  $DC -f "$COMPOSE_FILE" up -d --force-recreate "$SERVICE"
  info "已回滚到上一个镜像，等待启动..."
  sleep 5
  if probe_health; then
    info "回滚成功，服务已恢复"
  else
    fail "回滚后健康检查仍然失败，请查看：$DC -f $COMPOSE_FILE logs --tail=100 $SERVICE"
  fi
  exit 0
fi

check_env
cd "$APP_DIR" || fail "无法进入代码目录：$APP_DIR"

# ---------- 1. 备份数据库 ----------
info "步骤 1/6 备份数据库"
mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKED_UP=0
# 注意：这里刻意不使用 shopt -s nullglob。
# 一旦开启 nullglob，任何 "$DIR"/*.ext 在无匹配时会展开成空参数，
# `ls -1t "$DIR"/*.bak` 就会退化成 `ls -1t`（列当前目录），再接 xargs rm 会误删工作目录内容。
for db in "$DATA_DIR"/*.db; do
  [[ -e "$db" ]] || continue
  base="$(basename "$db")"
  cp -a "$db" "$BACKUP_DIR/${base}.${STAMP}.bak"
  info "  已备份 $base -> $BACKUP_DIR/${base}.${STAMP}.bak"
  BACKED_UP=1
done
if [[ "$BACKED_UP" -eq 0 ]]; then
  warn "  $DATA_DIR 下没有 .db 文件（可能用的是 PostgreSQL/MySQL），跳过文件备份"
  warn "  PostgreSQL 用户请自行确认有定期 pg_dump 策略"
fi
# 只保留最近 N 份备份：交给 safe_prune_backups（find 硬约束 + 路径守卫，不用 glob）
safe_prune_backups

# ---------- 2. 记录回滚点 ----------
info "步骤 2/6 记录当前镜像作为回滚点"
PREV_ID="$(docker inspect --format '{{.Image}}' "$( $DC -f "$COMPOSE_FILE" ps -q "$SERVICE" 2>/dev/null || true )" 2>/dev/null || true)"
if [[ -n "$PREV_ID" ]]; then
  docker tag "$PREV_ID" "${IMAGE}:previous"
  info "  回滚点已保存为 ${IMAGE}:previous"
else
  warn "  当前没有运行中的容器，本次更新无法自动回滚"
fi

# ---------- 3. 拉代码 ----------
info "步骤 3/6 更新代码"
if [[ "$SKIP_GIT" == "1" ]]; then
  info "  SKIP_GIT=1，跳过 git pull"
else
  git rev-parse --git-dir >/dev/null 2>&1 || fail "当前目录不是 git 仓库，用 SKIP_GIT=1 手动上传代码"
  git pull --ff-only origin "$BRANCH" || fail "git pull 失败（可能有本地改动），请先处理：git status"
fi
NEW_TAG="$(git rev-parse --short HEAD 2>/dev/null || echo "manual-$STAMP")"
info "  当前代码版本：$NEW_TAG"

# ---------- 4. 构建镜像 ----------
info "步骤 4/6 构建镜像 ${IMAGE}:${NEW_TAG}（首次较慢，之后走缓存）"
BUILD_ARGS=()
[[ -n "${REGISTRY:-}" ]] && BUILD_ARGS+=(--build-arg "REGISTRY=${REGISTRY}")
docker build -f Dockerfile.cn "${BUILD_ARGS[@]}" -t "${IMAGE}:${NEW_TAG}" -t "${IMAGE}:latest" . \
  || fail "镜像构建失败，服务未受影响，仍是旧版本"
info "  构建完成"

# ---------- 5. 重启 ----------
info "步骤 5/6 重启服务"
$DC -f "$COMPOSE_FILE" up -d --force-recreate "$SERVICE" || fail "容器启动失败"
info "  容器已启动，等待健康检查..."

# ---------- 6. 健康检查 ----------
info "步骤 6/6 健康检查"
OK=0
for i in $(seq 1 30); do
  if probe_health; then
    OK=1
    break
  fi
  sleep 2
done

if [[ "$OK" -eq 1 ]]; then
  info "更新成功，当前版本：${NEW_TAG}"
  docker image prune -f >/dev/null 2>&1 || true
  exit 0
fi

# ---------- 自动回滚 ----------
warn "健康检查失败，开始自动回滚"
$DC -f "$COMPOSE_FILE" logs --tail=60 "$SERVICE" || true
if [[ -n "$PREV_ID" ]]; then
  docker tag "$PREV_ID" "${IMAGE}:latest"
  $DC -f "$COMPOSE_FILE" up -d --force-recreate "$SERVICE"
  sleep 5
  if probe_health; then
    warn "已回滚到上一个版本，服务正常。请检查上面日志排查新版本问题。"
    exit 1
  fi
  fail "回滚后仍不可用，请立刻手动介入：$DC -f $COMPOSE_FILE logs -f $SERVICE"
fi
fail "健康检查失败且无回滚点，请手动介入"
