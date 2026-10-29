#!/usr/bin/env bash
#
# new-api 二开 · 生产升级脚本（这台服务器唯一入口）
# ==================================================================
# 适配形态（按你服务器实测核对，不是通用模板）：
#   · 仓库      /opt/new-api-gallery/new-api-gallery
#   · 编排      deploy/docker-compose.yml（new-api + redis + postgres 定义）
#   · 数据库    PostgreSQL 由 1Panel 侧承载 → 本脚本【不做数据库备份】
#               重建应用容器不会触碰数据库；DB 备份走你自己的 1Panel 计划任务
#               需要在升级前自动备份，就传 DB_BACKUP_CMD（见下）
#   · 数据挂载  deploy/data -> /data       deploy/logs -> /app/logs
#   · 配置      deploy/.env（SESSION_SECRET / CRYPT_KEY / SQL_DSN …）
#   · 对外      3000:3000；1Panel 反代可能写的是容器 IP
#
# 用法：
#   ./deploy/upgrade.sh                        升级（默认动作）
#   ./deploy/upgrade.sh --check                只体检，不改任何东西
#   ./deploy/upgrade.sh --rollback             镜像换回上一版并重启
#   SKIP_GIT=1 ./deploy/upgrade.sh             代码已手动放好，跳过 git pull
#   DB_BACKUP_CMD='pg_dump … > /root/db.sql' ./deploy/upgrade.sh
#                                              升级前先跑你自己的备份命令，失败即中止
#
# 安全约定（两起误删事故之后立的规矩，逐条对应）：
#   1. 全文没有任何 rm / rmdir / find -delete / git clean / xargs rm
#   2. 备份只增不减，什么时候清理由你自己决定
#   3. 数据目录不存在直接拒绝，不"顺手"建一个空目录顶上
#   4. 工作树只有权限位变化时自动修掉；有真实内容改动就拒绝 pull
#   5. 构建失败线上不受影响；探活失败自动换回上一版镜像
#   6. 脚本先把自己复制到 /tmp 再执行，避免 pull 改到脚本自身时 bash 读错位置
# ==================================================================

set -euo pipefail

SCRIPT_VER="2026-10-29.8-net-default"

# ---------- 自拷贝执行（见安全约定 6） ----------
if [[ "${__UPGRADE_REEXEC:-0}" != "1" ]]; then
  __src="${BASH_SOURCE[0]}"
  case "$__src" in
    /*) ;;
    *) __src="$(cd "$(dirname "$__src")" && pwd)/$(basename "$__src")" ;;
  esac
  __copy="${TMPDIR:-/tmp}/newapi-upgrade-run.sh"
  cp -f -- "$__src" "$__copy"
  chmod 700 "$__copy"
  export __UPGRADE_REEXEC=1
  export __UPGRADE_DIR="$(dirname "$__src")"
  export __UPGRADE_NAME="$(basename "$__src")"
  exec bash "$__copy" "$@"
fi

DIR="${__UPGRADE_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
ME="$DIR/${__UPGRADE_NAME:-upgrade.sh}"
REPO="$(cd "$DIR/.." && pwd)"
COMPOSE_FILE="$DIR/docker-compose.yml"
ENV_FILE="$DIR/.env"
DATA_DIR="$DIR/data"
LOG_DIR="$DIR/logs"
BACKUP_DIR="$DIR/backups"
IMAGE="new-api-gallery"
SERVICE="new-api"
CONTAINER="new-api-gallery"
BRANCH="${BRANCH:-gallery-fork}"
APP_PORT="${APP_PORT:-3000}"
# 这台机器上，SQL_DSN 写的是 1Panel 侧 PostgreSQL 的【容器名】，只能靠 docker 内置 DNS 解析，
# 所以本容器必须常驻 1panel-network（172.18.0.0/16，1Panel 里所有容器——含商店装的 PG/Redis——都在这个网）。
# 这个网络不在 deploy/docker-compose.yml 里，compose 重建容器后一定会丢 → 每次起来都补一遍。
# 想关掉： NEW_API_EXTRA_NETWORKS= ./deploy/upgrade.sh
EXTRA_NETS="${NEW_API_EXTRA_NETWORKS-1panel-network}"
STAMP="$(date +%Y%m%d-%H%M%S)"

info() { printf '[upgrade] %s\n' "$*"; }
warn() { printf '[warn] %s\n' "$*"; }
fail() { printf '[fail] %s\n' "$*" >&2; exit 1; }
step() { printf '\n===== %s =====\n' "$*"; }

compose() { docker compose -f "$COMPOSE_FILE" "$@"; }

have_curl() { command -v curl >/dev/null 2>&1; }

container_ip() {
  docker inspect "$CONTAINER" \
    --format '{{range .NetworkSettings.Networks}}{{.IPAddress}} {{end}}' 2>/dev/null \
    | awk 'NF { print $1; exit }' || true
}

container_mounts() {
  docker inspect "$CONTAINER" \
    --format '{{range .Mounts}}{{.Source}} -> {{.Destination}}{{"\n"}}{{end}}' 2>/dev/null || true
}

# ---------- docker 网络保持 ----------
# 为什么要这个：容器可能被【手工】接到 compose 之外的其他 docker 网络上
# （典型：数据库是 1Panel 装的，SQL_DSN 里写的是 1Panel-postgresql-xxx 这种容器名，
#  只有和它同处一个网络才能被 docker 内置 DNS 解析）。
# 而 `compose up` 一旦重建容器，这些手工接的网络会【全部丢失】→ 起来就报
#   hostname resolving error: lookup 1Panel-postgresql-xxx ... server misbehaving
# 所以：重建前记下现有网络，重建后把缺的补回去。
PRE_NETS=""
capture_networks() {
  PRE_NETS="$(docker inspect "$CONTAINER" \
    --format '{{range $k, $v := .NetworkSettings.Networks}}{{println $k}}{{end}}' 2>/dev/null || true)"
}

container_nets() {
  docker inspect "$CONTAINER" \
    --format '{{range $k, $v := .NetworkSettings.Networks}}{{println $k}}{{end}}' 2>/dev/null || true
}

restore_networks() {
  local cur net want
  cur="$(container_nets)"
  # 要保证在的网络 = 升级前就有的（可能含手工接的） + 固定要求的 EXTRA_NETS
  want="$(printf '%s\n%s\n' "${PRE_NETS:-}" "${EXTRA_NETS:-}" | sed '/^[[:space:]]*$/d' | sort -u || true)"
  if [[ -z "$want" ]]; then
    return 0
  fi
  while IFS= read -r net; do
    [[ -n "$net" ]] || continue
    if printf '%s\n' "$cur" | grep -qxF -- "$net"; then
      continue
    fi
    if ! docker network inspect "$net" >/dev/null 2>&1; then
      warn "  docker 网络不存在，跳过：$net（核对： docker network ls）"
      continue
    fi
    if docker network connect "$net" "$CONTAINER" >/dev/null 2>&1; then
      info "  已接上 docker 网络：$net"
    else
      warn "  接不上网络 $net（docker network connect 失败，查： docker inspect $CONTAINER）"
    fi
  done <<< "$want"
  return 0
}

# 探活失败时，从日志里认一下是不是「数据库主机名解析不了」这种网络问题
db_net_hint() {
  local logs
  logs="$(compose logs --tail=80 "$SERVICE" 2>/dev/null || true)"
  if printf '%s' "$logs" | grep -qE 'hostname resolving error|no such host|server misbehaving'; then
    warn "  日志显示【数据库主机名解析失败】—— 不是代码问题，是容器没接上数据库所在的 docker 网络"
    warn "  现场修（这台机器就是 1panel-network）："
    warn "    docker network connect ${EXTRA_NETS:-1panel-network} $CONTAINER"
    warn "    docker restart $CONTAINER"
    warn "  查现状： docker inspect $CONTAINER --format '{{range \$k,\$v := .NetworkSettings.Networks}}{{println \$k}}{{end}}'"
  fi
}

# ---------- 数据库现状（只读判断，不做备份） ----------
PG_HOST=""
PG_KIND=""
detect_pg() {
  PG_HOST=""
  if [[ ! -f "$ENV_FILE" ]]; then
    PG_KIND="未知（deploy/.env 不存在）"
    return 0
  fi
  local line dsn host
  line="$(grep -m1 -E '^[[:space:]]*SQL_DSN=' "$ENV_FILE" 2>/dev/null || true)"
  if [[ -z "$line" ]]; then
    PG_KIND="未设置 SQL_DSN（默认 SQLite）"
    return 0
  fi
  dsn="$(printf '%s' "${line#*=}" | tr -d "\"'")"
  host="${dsn#*://}"
  host="${host#*@}"
  host="${host%%/*}"
  host="${host%%:*}"
  PG_HOST="$host"
  case "$host" in
    postgres|new-api-gallery-pg) PG_KIND="compose 内置 PostgreSQL（$host）" ;;
    localhost|127.0.0.1|host.docker.internal) PG_KIND="宿主机上的 PostgreSQL（$host）" ;;
    "") PG_KIND="SQL_DSN 解析不出主机" ;;
    *) PG_KIND="外部 PostgreSQL（$host，1Panel 侧）" ;;
  esac
}

# ---------- 探活：容器内 → 宿主机端口 → 容器 IP ----------
# 按墙钟截止，不会被多端点超时叠加成几分钟（最坏 ceil(PROBE_TIMEOUT/2) 轮）
PROBE_TIMEOUT="${PROBE_TIMEOUT:-90}"
probe() {
  local deadline=$(( SECONDS + PROBE_TIMEOUT ))
  local ip
  while [[ $SECONDS -lt $deadline ]]; do
    if compose exec -T "$SERVICE" wget -qO- --timeout=2 \
         "http://127.0.0.1:${APP_PORT}/api/status" 2>/dev/null \
         | grep -q '"success":true'; then
      return 0
    fi
    if have_curl && curl -fsS --max-time 2 \
         "http://127.0.0.1:${APP_PORT}/api/status" 2>/dev/null \
         | grep -q '"success":true'; then
      return 0
    fi
    ip="$(container_ip)"
    if [[ -n "$ip" ]] && have_curl && curl -fsS --max-time 2 \
         "http://$ip:${APP_PORT}/api/status" 2>/dev/null \
         | grep -q '"success":true'; then
      return 0
    fi
    sleep 2
  done
  return 1
}

# ---------- 体检 ----------
check_env() {
  local head branch dirty behind
  info "环境体检"
  info "  脚本版本：$SCRIPT_VER"
  info "  仓库目录：$REPO"
  info "  编排文件：$COMPOSE_FILE"
  info "  配置文件：$ENV_FILE"
  info "  数据目录：$DATA_DIR"
  info "  备份目录：$BACKUP_DIR"

  [[ -d "$REPO/.git" ]]    || fail "不是 git 仓库：$REPO"
  [[ -f "$COMPOSE_FILE" ]] || fail "找不到编排文件：$COMPOSE_FILE"
  [[ -f "$ENV_FILE" ]]     || fail "找不到 $ENV_FILE
       → 里面的 SESSION_SECRET / CRYPT_KEY 丢了会导致全员掉线
       → 先跑这条把它找回来（会先用 deploy/backups/env.* 备份，没有就从运行中的容器取）：
           $DIR/restore-env.sh --dry-run   # 先看会从哪恢复
           $DIR/restore-env.sh             # 真的恢复
       → 若上面两条都不行，先人工确认，别急着重建容器"
  docker compose version >/dev/null 2>&1 || fail "找不到 docker compose"

  head="$(git -C "$REPO" rev-parse --short HEAD 2>/dev/null || echo '?')"
  branch="$(git -C "$REPO" branch --show-current 2>/dev/null || echo '?')"
  info "  仓库 HEAD：$head（分支 $branch）"
  if docker inspect "$CONTAINER" >/dev/null 2>&1; then
    local nets
    nets="$(container_nets)"
    info "  容器网络：$(printf '%s' "$nets" | tr '\n' ' ')"
    if [[ -n "${EXTRA_NETS:-}" ]] && [[ -n "$nets" ]] && ! printf '%s\n' "$nets" | grep -qxF -- "$EXTRA_NETS"; then
      warn "  容器没接到 $EXTRA_NETS —— 数据库是 1Panel 的 PG，SQL_DSN 用容器名，"
      warn "  不在同一网络就会 hostname resolving error 起不来。升级时脚本会自动补接；"
      warn "  现在就想修： docker network connect $EXTRA_NETS $CONTAINER && docker restart $CONTAINER"
    fi
  fi
  [[ "$branch" == "$BRANCH" ]] || warn "  当前分支是 $branch，不是 $BRANCH，pull 可能不符合预期"

  if git -C "$REPO" fetch --prune -q origin "$BRANCH" 2>/dev/null; then
    behind="$(git -C "$REPO" rev-list --count "HEAD..origin/$BRANCH" 2>/dev/null || echo '?')"
    info "  远端落后：$behind 个提交（origin/$BRANCH）"
  else
    warn "  git fetch 失败（网络或凭据问题），无法判断是否有新版本"
  fi

  dirty="$(git -C "$REPO" status --porcelain --untracked-files=no 2>/dev/null || true)"
  if [[ -n "$dirty" ]]; then
    warn "  工作树有未提交改动："
    printf '%s\n' "$dirty" | sed 's/^/        /'
  else
    info "  工作树：干净"
  fi

  detect_pg
  info "  数据库：$PG_KIND"
  info "  数据库备份：本脚本不做（重建应用容器不触碰数据库）"

  if [[ -d "$DATA_DIR" ]]; then
    info "  数据目录：存在（$(du -sh "$DATA_DIR" 2>/dev/null | cut -f1) / $(find "$DATA_DIR" -maxdepth 1 -type f 2>/dev/null | wc -l) 个文件）"
  else
    warn "  数据目录不存在：$DATA_DIR —— 升级会被拒绝（不会自动创建空目录）"
  fi

  info "  镜像 ${IMAGE}:latest   $(docker image inspect --format '{{.Created}}' "${IMAGE}:latest" 2>/dev/null || echo '（无）')"
  info "  镜像 ${IMAGE}:previous $(docker image inspect --format '{{.Created}}' "${IMAGE}:previous" 2>/dev/null || echo '（无，首次升级后才有）')"

  local st ip
  st="$(docker inspect "$CONTAINER" --format '{{.State.Status}}' 2>/dev/null || echo '不存在')"
  info "  容器 $CONTAINER：$st"
  ip="$(container_ip)"
  if [[ -n "$ip" ]]; then
    info "  容器 IP：$ip  ← 1Panel 反代若写的是容器 IP，重建后请确认仍是这个（或改成 127.0.0.1:${APP_PORT}）"
  fi
  if [[ "$st" == "running" ]]; then
    info "  当前挂载："
    container_mounts | sed 's/^/        /'
  fi
}

# ---------- 工作树脏：仅权限位变化自动修掉 ----------
status_path() {
  local line="$1"
  local p="${line:3}"
  p="${p%% -> *}"
  p="${p%\"}"; p="${p#\"}"
  printf '%s' "$p"
}

heal_mode_only_or_die() {
  local dirty="$1"
  local line p nums
  local mode_only=1
  local paths=()

  while IFS= read -r line; do
    [[ -z "$line" ]] && continue
    p="$(status_path "$line")"
    paths+=("$p")
    nums="$(git -C "$REPO" diff HEAD --numstat -- "$p" 2>/dev/null | awk '{print $1" "$2}')"
    if [[ "$nums" != "0 0" ]]; then
      mode_only=0
    fi
  done <<< "$dirty"

  if [[ "$mode_only" == "1" ]]; then
    warn "  本地改动全部只是权限位变化（多半来自 chmod +x），自动丢弃这部分改动"
    git -C "$REPO" checkout HEAD -- "${paths[@]}"
    return 0
  fi

  printf '\n' >&2
  printf '以下文件有真实内容改动，为避免覆盖，本次不拉代码：\n' >&2
  printf '%s\n' "$dirty" | sed 's/^/  /' >&2
  cat >&2 <<EOF

请选一种处理方式：
  a) 只是被误删（行首 D）：  cd $REPO && git ls-files -d -z | xargs -0 -r git checkout --
  b) 想保留改动先收起来：    cd $REPO && git stash push -m "server-local"
  c) 只按当前代码重建：      SKIP_GIT=1 $ME
EOF
  exit 1
}

# ---------- 回滚 ----------
do_rollback() {
  docker image inspect "${IMAGE}:previous" >/dev/null 2>&1 \
    || fail "没有 ${IMAGE}:previous 镜像，无法回滚（首次升级前不存在这个标签）"
  info "把 ${IMAGE}:previous 重新打为 ${IMAGE}:latest"
  docker tag "${IMAGE}:previous" "${IMAGE}:latest"
  compose up -d --no-deps --force-recreate "$SERVICE"
  restore_networks
}

# ==================================================================
# 参数
# ==================================================================
MODE="upgrade"
case "${1:-}" in
  "")            MODE="upgrade" ;;
  --check)       MODE="check" ;;
  --rollback)    MODE="rollback" ;;
  -h|--help)     awk 'NR>1 { if (/^#/) { sub(/^# ?/, ""); print } else exit }' "${BASH_SOURCE[0]}"; exit 0 ;;
  *)             fail "未知参数：$1（可用：--check / --rollback / --help）" ;;
esac

if [[ "${SKIP_DB_BACKUP:-0}" == "1" ]]; then
  info "注：本脚本已不再备份数据库，SKIP_DB_BACKUP 不需要了（已忽略）"
fi

if [[ "$MODE" == "check" ]]; then
  check_env
  printf '\n体检结束，未改动任何东西。\n直接升级： %s\n' "$ME"
  exit 0
fi

if [[ "$MODE" == "rollback" ]]; then
  check_env
  step "回滚到上一版镜像"
  do_rollback
  if probe; then
    info "回滚完成，服务已恢复（HEAD 未变，仍是 $(git -C "$REPO" rev-parse --short HEAD)）"
    info "如需连代码一起退回，看 $BACKUP_DIR 下的 commit.*.txt 里记录的旧 HEAD"
  else
    fail "回滚后仍探活失败，请人工检查： docker compose -f $COMPOSE_FILE logs --tail=100 $SERVICE"
  fi
  exit 0
fi

# ==================================================================
# 正式升级
# ==================================================================
check_env

# 硬闸 1：数据目录必须存在（否则重建会顶上一个空目录）
[[ -d "$DATA_DIR" ]] || fail "数据目录不存在：$DATA_DIR
       → 它是容器 /data 的挂载源，缺了会挂上一个空目录
       → 请先确认它是不是被移动或删除了，别急着重建容器"

# 硬闸 2：stamp 目录可写
mkdir -p "$BACKUP_DIR"
[[ -w "$BACKUP_DIR" ]] || fail "备份目录不可写：$BACKUP_DIR"

PRE_HEAD="$(git -C "$REPO" rev-parse HEAD)"
capture_networks
if [[ -n "$PRE_NETS" ]]; then
  info "  容器现有 docker 网络：$(printf '%s' "$PRE_NETS" | tr '\n' ' ')"
fi

# ---------- 1. 回滚点 ----------
step "1/6 记录回滚点"
if docker image inspect "${IMAGE}:latest" >/dev/null 2>&1; then
  docker tag "${IMAGE}:latest" "${IMAGE}:previous"
  info "  当前镜像已标记为 ${IMAGE}:previous（回滚用）"
else
  warn "  没有 ${IMAGE}:latest，本次构建失败将无法自动回滚"
fi

# ---------- 2. 备份配置 ----------
step "2/6 备份配置"
cp -a "$ENV_FILE" "$BACKUP_DIR/env.$STAMP"
chmod 600 "$BACKUP_DIR/env.$STAMP"
printf '%s\n' "$PRE_HEAD" > "$BACKUP_DIR/commit.$STAMP.txt"
info "  deploy/.env        -> $BACKUP_DIR/env.$STAMP"
info "  升级前 HEAD        -> $BACKUP_DIR/commit.$STAMP.txt（$PRE_HEAD）"

# ---------- 3. 数据库备份（可选，交给你） ----------
step "3/6 数据库备份"
if [[ -n "${DB_BACKUP_CMD:-}" ]]; then
  info "  执行 DB_BACKUP_CMD：$DB_BACKUP_CMD"
  bash -c "$DB_BACKUP_CMD" || fail "DB_BACKUP_CMD 失败，已中止（不动线上）"
  info "  备份命令执行成功"
else
  info "  跳过（$PG_KIND）"
  info "  重建应用容器不会触碰数据库，数据本身没有风险"
  info "  想在升级前自动备份，下次这样跑："
  info "    DB_BACKUP_CMD='pg_dump -h <host> -U <user> -d new-api > /root/db-\$(date +%F).sql' $ME"
fi

# ---------- 4. 更新代码 ----------
step "4/6 更新代码"
if [[ "${SKIP_GIT:-0}" == "1" ]]; then
  info "  SKIP_GIT=1，跳过 git pull（HEAD=$PRE_HEAD）"
else
  git -C "$REPO" fetch --prune -q origin "$BRANCH" || fail "git fetch 失败（网络？）"
  BEHIND="$(git -C "$REPO" rev-list --count "HEAD..origin/$BRANCH" 2>/dev/null || echo 0)"
  if [[ "$BEHIND" == "0" ]]; then
    info "  已是最新（$PRE_HEAD），无需 pull；按当前代码重建"
  else
    info "  远端领先 $BEHIND 个提交"
    DIRTY="$(git -C "$REPO" status --porcelain --untracked-files=no 2>/dev/null || true)"
    if [[ -n "$DIRTY" ]]; then
      heal_mode_only_or_die "$DIRTY"
    fi
    git -C "$REPO" pull --ff-only origin "$BRANCH" || fail "git pull 失败（可能有分叉）
       → 看： cd $REPO && git status
       → 或： SKIP_GIT=1 $ME 用当前代码重建"
    info "  HEAD $PRE_HEAD -> $(git -C "$REPO" rev-parse --short HEAD)"
  fi
fi

# ---------- 5. 构建（旧容器仍在服务） ----------
step "5/6 构建镜像（旧容器继续对外服务，这一步最慢）"
# 用哪个 Dockerfile：
#   Dockerfile.cn  —— 国内加速版（goproxy.cn + npmmirror + 基础镜像走加速器），国内服务器必须用这个。
#   上游 Dockerfile —— 直连 docker.io 与 proxy.golang.org，国内基本拉不动/极慢。
# 这里自己 docker build 而不用 compose build，是为了不受 compose 里 dockerfile 那行影响
# （服务器上那行可能被手工改过，改了下次 pull 还会冲突）。
DOCKERFILE="${NEW_API_DOCKERFILE:-}"
if [[ -z "$DOCKERFILE" ]]; then
  if [[ -f "$REPO/Dockerfile.cn" ]]; then DOCKERFILE="Dockerfile.cn"; else DOCKERFILE="Dockerfile"; fi
fi
[[ -f "$REPO/$DOCKERFILE" ]] || fail "找不到 $REPO/$DOCKERFILE（代码不完整？）"
info "  使用 $DOCKERFILE 构建 ${IMAGE}:latest"
if ! docker build -f "$REPO/$DOCKERFILE" -t "${IMAGE}:latest" "$REPO"; then
  warn "构建失败，线上仍是旧容器，服务未受影响"
  warn "若报 preprofile / default.pgo：是旧版 Dockerfile.cn 的 PGO 路径问题，git pull 到最新代码即可（已修）"
  [[ "$(git -C "$REPO" rev-parse HEAD)" != "$PRE_HEAD" ]] \
    && warn "注意：代码已更新到 $(git -C "$REPO" rev-parse --short HEAD)，但镜像是旧的；修好后重跑本脚本即可（幂等）"
  exit 1
fi
info "  构建完成：$(docker image inspect --format '{{.Created}}' "${IMAGE}:latest" 2>/dev/null || echo '?')"

# ---------- 6. 启动 ----------
step "6/6 启动新容器并探活"
if ! compose up -d --no-deps "$SERVICE"; then
  warn "启动失败，尝试回滚"
  do_rollback
  probe && warn "已回滚，服务正常" || fail "回滚后仍不可用，请人工介入"
  exit 1
fi
restore_networks

info "  探活 http://127.0.0.1:${APP_PORT}/api/status（最多 ${PROBE_TIMEOUT} 秒）…"
if probe; then
  NEW_IP="$(container_ip)"
  printf '\n'
  info "升级完成"
  info "  代码版本：$(git -C "$REPO" rev-parse --short HEAD)"
  info "  镜像时间：$(docker image inspect --format '{{.Created}}' "${IMAGE}:latest" 2>/dev/null || echo '?')"
  info "  容器 IP ：${NEW_IP:-未知}"
  if [[ -n "$NEW_IP" ]]; then
    info "  → 1Panel 反代若写的是容器 IP，请确认就是 $NEW_IP；不一致就改反代（也可改成 127.0.0.1:${APP_PORT}，端口已发布，以后不再受 IP 漂移影响）"
  fi
  info "  挂载检查："
  container_mounts | sed 's/^/        /'
  if ! container_mounts | grep -qF "$DATA_DIR -> /data"; then
    warn "  ！容器 /data 的挂载源不是 $DATA_DIR，请立刻核对（可能是空站）"
  fi
  info "  备份留在：$BACKUP_DIR（env.$STAMP / commit.$STAMP.txt）"
  info "  需要回滚：$ME --rollback"
else
  warn "${PROBE_TIMEOUT} 秒内探活未通过，自动回滚到上一版"
  compose logs --tail=40 "$SERVICE" 2>/dev/null || true
  db_net_hint
  do_rollback
  if probe; then
    fail "已回滚，服务恢复正常。请把上面的日志发出来排查新版本"
  else
    fail "回滚后仍探活失败，请人工介入： docker compose -f $COMPOSE_FILE logs --tail=100 $SERVICE"
  fi
fi
