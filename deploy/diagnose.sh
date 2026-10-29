#!/usr/bin/env bash
#
# new-api 现状诊断 + 一步升级
# ------------------------------------------------------------------
# 作用：把服务器上正在跑的 new-api 摸清楚，输出一份可直接粘贴给 AI/同事的报告，
#       按当前容器 1:1 生成 compose 草稿，并给出一份只针对本机的升级计划。
#       加 --upgrade 就地执行升级（备份/构建/切容器/探活/失败回滚全自动）。
#
# 用法：
#   ./deploy/diagnose.sh               只诊断：输出报告 + 本机专属升级计划（口令已脱敏）
#   ./deploy/diagnose.sh --plan        只打升级计划，不打完整报告
#   ./deploy/diagnose.sh --write       额外把 compose 写到 /opt/new-api-gallery/docker-compose.yml
#                                      （文件里是真实口令，报告里仍然脱敏）
#   ./deploy/diagnose.sh --upgrade     诊断完直接升级（先自动备份；失败自动回滚）
#   ./deploy/diagnose.sh --upgrade --yes   免交互确认（脚本/无人值守时用）
#   ./deploy/diagnose.sh --skip-git    升级时不执行 git pull（代码已手动上传）
#   ./deploy/diagnose.sh <容器名>       指定容器
#
# 安全：除 --upgrade 外全部只读。SESSION_SECRET / CRYPT_KEY / 库口令在报告里脱敏。
# ------------------------------------------------------------------

set -uo pipefail

C_NAME=""
WRITE=0
DO_UPGRADE=0
DO_PLAN=0
ASSUME_YES=0
SKIP_GIT=0
for arg in "$@"; do
  case "$arg" in
    --write|-w)   WRITE=1 ;;
    --upgrade|-u) DO_UPGRADE=1 ;;
    --plan|-p)    DO_PLAN=1 ;;
    --yes|-y)     ASSUME_YES=1 ;;
    --skip-git)   SKIP_GIT=1 ;;
    -h|--help)    awk 'NR>1 && /^#/ {print; next} NR>1 {exit}' "$0"; exit 0 ;;
    -*)           printf '未知参数：%s（-h 看用法）\n' "$arg" >&2; exit 2 ;;
    *)            C_NAME="$arg" ;;
  esac
done

sec() { printf '\n===== %s =====\n' "$*"; }
kv()  { printf '%s: %s\n' "$1" "$2"; }
note(){ printf '  %s\n' "$*"; }

have() { command -v "$1" >/dev/null 2>&1; }

# 脱敏
mask_env() {
  local line="$1" k v
  k="${line%%=*}"; v="${line#*=}"
  case "$k" in
    SESSION_SECRET|CRYPT_KEY|*PASSWORD*|*PASS*|*SECRET*|*TOKEN*)
      printf '%s=*** (len=%s, head=%s)\n' "$k" "${#v}" "${v:0:4}" ;;
    SQL_DSN|REDIS_CONN_STRING)
      printf '%s=%s\n' "$k" "$(printf '%s' "$v" | sed -E 's#(:[^:@/]+)@#:***@#')" ;;
    *)
      printf '%s\n' "$line" ;;
  esac
}

# --plan 只输出计划：把诊断段的 stdout 吞掉，第 12 段再恢复
if [[ "$DO_PLAN" -eq 1 ]]; then exec 3>&1 1>/dev/null; fi

sec "0. 主机"
kv "时间"       "$(date '+%F %T %Z')"
kv "系统"       "$( (. /etc/os-release 2>/dev/null && echo "${PRETTY_NAME:-unknown}") || uname -s)"
kv "内核"       "$(uname -r)"
kv "CPU"        "$(nproc) 核"
kv "内存"       "$(free -h 2>/dev/null | awk '/^Mem:/{print $2}')"
kv "磁盘根分区" "$(df -h / 2>/dev/null | awk 'NR==2{print $2" 总 / "$4" 可用 ("$5" 已用)"}')"
kv "Docker"     "$(docker -v 2>/dev/null || echo '未安装')"
kv "Compose"    "$( (docker compose version 2>/dev/null || docker-compose -v 2>/dev/null | head -1) || echo '无')"

if ! have docker; then
  printf '\n没有 docker，无法继续。\n' >&2
  exit 1
fi

# ---------- 1. 容器 ----------
sec "1. 相关容器"
docker ps -a --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}' 2>/dev/null \
  | grep -Ei 'NAMES|new-?api|newapi|gallery' || echo "(没有匹配到 new-api 相关容器)"

if [[ -z "$C_NAME" ]]; then
  C_NAME="$(docker ps --format '{{.Names}}\t{{.Image}}' 2>/dev/null \
    | grep -Ei 'new-?api|newapi' | head -1 | cut -f1)"
fi
if [[ -z "$C_NAME" ]]; then
  printf '\n没自动找到运行中的 new-api 容器。请手动指定： %s <容器名>\n' "$0" >&2
  exit 1
fi
printf '\n>> 本次分析容器：%s\n' "$C_NAME"

if ! docker inspect "$C_NAME" >/dev/null 2>&1; then
  printf '容器不存在：%s\n' "$C_NAME" >&2
  exit 1
fi

f() { docker inspect --format "$1" "$C_NAME" 2>/dev/null; }

# ---------- 2. 基本信息 ----------
sec "2. 基本信息"
CUR_IMG="$(f '{{.Config.Image}}')"
CUR_IMG="${CUR_IMG:-未知镜像}"
kv "镜像"         "$CUR_IMG"
kv "镜像构建时间" "$(docker image inspect --format '{{.Created}}' "$CUR_IMG" 2>/dev/null || echo '未知')"
kv "容器创建时间" "$(f '{{.Created}}')"
kv "运行状态"     "$(f '{{.State.Status}}')（重启次数 $(f '{{.RestartCount}}')）"
kv "重启策略"     "$(f '{{.HostConfig.RestartPolicy.Name}}')"
kv "启动命令"     "$(f '{{json .Config.Cmd}}')"
kv "Entrypoint"   "$(f '{{json .Config.Entrypoint}}')"
kv "工作目录"     "$(f '{{.Config.WorkingDir}}')"
kv "compose 项目" "$(f '{{index .Config.Labels "com.docker.compose.project"}}')"
kv "compose 服务" "$(f '{{index .Config.Labels "com.docker.compose.service"}}')"

# ---------- 3. 挂载 ----------
sec "3. 挂载（数据在这里，换镜像必须沿用）"
ROWS="$(f '{{range .Mounts}}{{.Type}}|{{.Name}}|{{.Source}}|{{.Destination}}|{{if .RW}}rw{{else}}ro{{end}}{{println}}{{end}}')"
if [[ -z "${ROWS//[[:space:]]/}" ]]; then
  echo "(无挂载 —— 危险：数据在容器内，重建即丢)"
else
  printf '%s\n' "$ROWS" | while IFS='|' read -r t n s d rw; do
    [[ -z "$t" && -z "$s" ]] && continue
    if [[ "$t" == "bind" ]]; then
      note "$t  $s  ->  $d  ($rw)"
    else
      note "$t  ${n:-?}  ->  $d  ($rw)"
    fi
  done
fi

# ---------- 4. 数据文件 ----------
sec "4. 数据文件（SQLite 判断依据）"
DATA_HOST=""
for dest in /data /app/data /app; do
  src="$(f "{{range .Mounts}}{{if eq .Destination \"$dest\"}}{{.Source}}{{end}}{{end}}")"
  [[ -z "$src" ]] && continue
  echo "\$ ls -lh $src    （容器内 $dest）"
  ls -lh "$src" 2>/dev/null | head -15 | sed 's/^/  /' || note "(宿主机读不到)"
  if [[ -f "$src/one-api.db" ]]; then
    DATA_HOST="$src"
    note ">> SQLite 在用：$src/one-api.db  ($(du -h "$src/one-api.db" 2>/dev/null | cut -f1))"
  fi
done
[[ -z "$DATA_HOST" ]] && note "(没发现 one-api.db —— 可能用 PostgreSQL/MySQL，或者路径在上面没列为空)"

# ---------- 5. 环境变量 ----------
sec "5. 环境变量（已脱敏）"
ENVS="$(f '{{range .Config.Env}}{{println .}}{{end}}' \
  | grep -Ev '^(PATH|HOSTNAME|HOME|TERM|LANG|LC_ALL|GODEBUG|GOTRACEBACK|PWD|SHLVL|SSL_CERT_FILE|SSL_CERT_DIR)=' || true)"
if [[ -z "$ENVS" ]]; then
  echo "(无自定义环境变量 —— SESSION_SECRET 没设，每次重启全员掉线)"
else
  printf '%s\n' "$ENVS" | while IFS= read -r l; do mask_env "$l"; done
fi

# ---------- 6. 网络 ----------
sec "6. 网络与 IP（反代指的就是这个 IP）"
NETS="$(f '{{range $k, $v := .NetworkSettings.Networks}}{{$k}}|{{$v.IPAddress}}{{println}}{{end}}')"
if [[ -z "${NETS//[[:space:]]/}" ]]; then
  echo "(无网络信息)"
else
  printf '%s\n' "$NETS" | while IFS='|' read -r n ip; do
    [[ -z "$n" ]] && continue
    note "$n   IP=$ip"
  done
fi

echo "-- 网段（确认能否固定 IP；默认 bridge 不能固定）--"
for n in $(printf '%s\n' "$NETS" | cut -d'|' -f1 | grep -v '^$'); do
  sub="$(docker network inspect --format '{{range .IPAM.Config}}{{.Subnet}} {{end}}' "$n" 2>/dev/null)"
  drv="$(docker network inspect --format '{{.Driver}}' "$n" 2>/dev/null)"
  note "$n   driver=$drv   网段=${sub:-未知}"
done

# ---------- 7. 端口 ----------
sec "7. 端口映射"
PB="$(f '{{range $p, $b := .HostConfig.PortBindings}}{{$p}}|{{range $b}}{{.HostIp}}:{{.HostPort}};{{end}}{{println}}{{end}}')"
if [[ -z "${PB//[[:space:]]/}" ]]; then
  echo "(没有发布到宿主机 —— 正常：反代直连容器 IP，不占宿主端口)"
else
  printf '%s\n' "$PB" | while IFS='|' read -r cp map_; do
    [[ -z "$cp" ]] && continue
    note "容器 $cp  <-  $map_"
  done
fi

# ---------- 8. 反代线索 ----------
sec "8. 反代线索"
FIRST_IP="$(printf '%s\n' "$NETS" | cut -d'|' -f2 | grep -v '^$' | head -1)"
if [[ -n "${FIRST_IP:-}" ]]; then
  kv "本容器 IP" "$FIRST_IP"
  echo "-- 哪些 nginx 配置提到了这个 IP --"
  found=0
  for d in /opt/1panel/apps/openresty /opt/1panel/www /etc/nginx /www/server/panel/vhost; do
    [[ -d "$d" ]] || continue
    while IFS= read -r hit; do
      [[ -z "$hit" ]] && continue
      note "$hit"; found=1
    done < <(grep -rln --include='*.conf' "$FIRST_IP" "$d" 2>/dev/null | head -5)
  done
  [[ "$found" -eq 0 ]] && note "(没搜到 —— 反代可能在别的路径，或 1Panel 里按容器名解析)"
  echo "-- proxy_pass 行 --"
  grep -rn --include='*.conf' "proxy_pass.*${FIRST_IP}" /opt/1panel/apps/openresty /etc/nginx 2>/dev/null | head -5 | sed 's/^/  /' || true
fi

# ---------- 9. 应用自检 ----------
sec "9. 应用自检"
if [[ -n "${FIRST_IP:-}" ]]; then
  echo "\$ curl http://$FIRST_IP:3000/api/status"
  curl -s --max-time 5 "http://$FIRST_IP:3000/api/status" | head -c 400
  echo
fi
echo "\$ docker exec $C_NAME /new-api --version"
docker exec "$C_NAME" /new-api --version 2>/dev/null | head -3 || echo "  (取不到)"
echo "\$ grep -ac 18009444 /new-api   （>=1 = 跑的是我们二开的前端）"
docker exec "$C_NAME" sh -c 'grep -ac "18009444" /new-api 2>/dev/null || echo 0' 2>/dev/null || echo "  (取不到)"
echo "\$ 最近迁移日志"
docker logs --tail 300 "$C_NAME" 2>&1 | grep -iE 'migrat|prompt_gallery|canvas_document' | tail -5 || echo "  (无)"

# ---------- 10. 代码目录 ----------
sec "10. 代码目录"
APP_DIR="${DIAG_APP_DIR:-/opt/new-api-gallery/new-api-gallery}"
if [[ -d "$APP_DIR/.git" ]]; then
  kv "代码目录" "$APP_DIR"
  kv "当前分支" "$(git -C "$APP_DIR" branch --show-current 2>/dev/null)"
  kv "当前提交" "$(git -C "$APP_DIR" log --oneline -1 2>/dev/null)"
  kv "本地改动" "$(git -C "$APP_DIR" status --porcelain 2>/dev/null | wc -l) 个文件"
  [[ -f "$APP_DIR/deploy/update.sh" ]]   && kv "update.sh" "已存在"   || kv "update.sh" "缺失（还没 pull 到最新）"
  [[ -f "$APP_DIR/deploy/diagnose.sh" ]] && kv "diagnose.sh" "已存在" || kv "diagnose.sh" "缺失"
else
  kv "代码目录" "$APP_DIR 不存在或不是 git 仓库"
fi
[[ -f /opt/new-api-gallery/docker-compose.yml ]] \
  && kv "运行时编排" "/opt/new-api-gallery/docker-compose.yml 已存在" \
  || kv "运行时编排" "未创建"

# ---------- 11. compose 草稿 ----------
# gen_compose <mask:0|1>
gen_compose() {
  local mask="$1" CMD src suf esc
  echo 'services:'
  echo '  new-api:'
  echo '    image: new-api-gallery:latest'
  printf '    container_name: %s\n' "$C_NAME"
  printf '    restart: %s\n' "$(f '{{.HostConfig.RestartPolicy.Name}}')"
  CMD="$(f '{{json .Config.Cmd}}')"
  if [[ "$CMD" != "null" && -n "$CMD" ]]; then
    printf '    command: %s\n' "$CMD"
  fi
  if [[ -n "${PB//[[:space:]]/}" ]]; then
    echo '    ports:'
    printf '%s\n' "$PB" | while IFS='|' read -r cp map_; do
      [[ -z "$cp" ]] && continue
      printf '      - "%s:%s"\n' "${map_%%;*}" "$cp"
    done
  fi
  echo '    volumes:'
  printf '%s\n' "$ROWS" | while IFS='|' read -r t n s d rw; do
    [[ -z "$t" ]] && continue
    src="$s"; [[ "$t" != "bind" ]] && src="$n"
    suf=""; [[ "$rw" == "ro" ]] && suf=":ro"
    printf '      - %s:%s%s\n' "$src" "$d" "$suf"
  done
  echo '    environment:'
  printf '%s\n' "$ENVS" | grep -v '^$' | while IFS= read -r l; do
    local k="${l%%=*}" v="${l#*=}"
    case "$k" in
      SESSION_SECRET|CRYPT_KEY|*PASSWORD*|*PASS*|*SECRET*|*TOKEN*)
        if [[ "$mask" == "1" ]]; then
          printf '      - "%s=*** 已脱敏 len=%s head=%s"\n' "$k" "${#v}" "${v:0:4}"
        else
          printf '      - "%s=%s"\n' "$k" "$v"
        fi ;;
      SQL_DSN|REDIS_CONN_STRING)
        if [[ "$mask" == "1" ]]; then
          printf '      - "%s=%s"\n' "$k" "$(printf '%s' "$v" | sed -E 's#(:[^:@/]+)@#:***@#')"
        else
          printf '      - "%s=%s"\n' "$k" "$v"
        fi ;;
      *)
        esc="$(printf '%s' "$l" | sed 's/"/\\"/g')"
        printf '      - "%s"\n' "$esc" ;;
    esac
  done
  echo '    networks:'
  local n ip
  for n in $(printf '%s\n' "$NETS" | cut -d'|' -f1 | grep -v '^$'); do
    ip="$(printf '%s\n' "$NETS" | awk -F'|' -v n="$n" '$1==n{print $2}')"
    if [[ -n "$ip" ]]; then
      printf '      %s:\n        ipv4_address: %s\n' "$n" "$ip"
    else
      printf '      %s:\n' "$n"
    fi
  done
  echo 'networks:'
  for n in $(printf '%s\n' "$NETS" | cut -d'|' -f1 | grep -v '^$'); do
    printf '  %s:\n    external: true\n' "$n"
  done
}

TARGET_DIR="${DIAG_TARGET_DIR:-/opt/new-api-gallery}"
TARGET_FILE="$TARGET_DIR/docker-compose.yml"

if [[ "$DO_PLAN" -eq 0 ]]; then
if [[ "$WRITE" -eq 1 ]]; then
  sec "11. 写出 compose 文件"
  mkdir -p "$TARGET_DIR" || echo "  创建 $TARGET_DIR 失败（权限？）"
  if [[ -f "$TARGET_FILE" ]]; then
    bak="$TARGET_FILE.bak.$(date +%Y%m%d-%H%M%S)"
    cp -a "$TARGET_FILE" "$bak" && note "已备份旧文件 -> $bak"
  fi
  if gen_compose 0 > "$TARGET_FILE"; then
    chmod 600 "$TARGET_FILE"
    note "已写入 $TARGET_FILE （600，含真实口令，别外传）"
    note "核对命令：cat $TARGET_FILE"
  else
    note "写入失败"
  fi
  echo
  echo "-- 报告用草稿（口令脱敏，内容与文件一致）--"
else
  sec "11. compose 草稿（按当前容器 1:1 生成，口令已脱敏）"
  note "想看可直接用的版本： $0 $C_NAME --write"
fi

echo '```yaml'
gen_compose 1
echo '```'
fi

# ==================================================================
# 12. 升级计划 / 执行
# ==================================================================
if [[ "$DO_PLAN" -eq 1 ]]; then exec 1>&3 3>&-; fi

PLAN_PORT="$(printf '%s\n' "$ENVS" | awk -F= '$1=="PORT"{print $2}' | head -1)"
PLAN_PORT="${PLAN_PORT:-3000}"
IMAGE_TAG="new-api-gallery"
BACKUP_DIR="${DIAG_BACKUP_DIR:-$TARGET_DIR/backups}"
NET_NAME="$(printf '%s\n' "$NETS" | cut -d'|' -f1 | grep -v '^$' | head -1)"
COMPOSE_MANAGED=0
[[ -n "$(f '{{index .Config.Labels "com.docker.compose.project"}}')" ]] && COMPOSE_MANAGED=1
IS_GALLERY=0
docker exec "$C_NAME" sh -c 'grep -aq "18009444" /new-api' 2>/dev/null && IS_GALLERY=1
HAS_SECRET=0
printf '%s\n' "$ENVS" | grep -q '^SESSION_SECRET=' && HAS_SECRET=1
SQL_DSN_VAL="$(printf '%s\n' "$ENVS" | awk -F= '$1=="SQL_DSN"{sub(/^[^=]*=/,"");print;exit}')"
DB_FILE=""
[[ -n "$DATA_HOST" ]] && DB_FILE="$DATA_HOST/one-api.db"
AVAIL_KB="$(df -Pk / 2>/dev/null | awk 'NR==2{print $4}')"; AVAIL_KB="${AVAIL_KB:-0}"
BACKREF="$(grep -rl --include='*.conf' "$FIRST_IP" /opt/1panel/apps/openresty /etc/nginx 2>/dev/null | head -1)"
CODE_VER="$(git -C "$APP_DIR" log --oneline -1 2>/dev/null || echo '无')"

plan_upgrade() {
  sec "12. 升级计划（按本机实测生成，只有这一条路径）"

  printf '【现状】\n'
  printf '  容器      %s   %s\n' "$C_NAME" \
    "$([[ "$COMPOSE_MANAGED" -eq 1 ]] && echo '｜ compose 管理' || echo '｜ docker run 起的')"
  printf '  当前镜像  %s   %s\n' "$CUR_IMG" \
    "$([[ "$IS_GALLERY" -eq 1 ]] && echo '｜ 已是二开版' || echo '｜ 官方版，需替换')"
  if [[ -n "$DB_FILE" && -f "$DB_FILE" ]]; then
    printf '  数据      SQLite  %s  %s\n' "$DB_FILE" "$(du -h "$DB_FILE" 2>/dev/null | cut -f1)"
  elif [[ -n "$SQL_DSN_VAL" ]]; then
    printf '  数据      外部数据库（SQL_DSN 已配，升级不碰它）\n'
  else
    printf '  数据      ！！既没有数据库文件也没配 SQL_DSN\n'
  fi
  if [[ "$HAS_SECRET" -eq 1 ]]; then
    printf '  会话密钥  SESSION_SECRET 已设，会原样沿用（用户不掉线）\n'
  else
    printf '  会话密钥  ！！未设置，每次重启全员掉线 —— 本次会一并生成固定值\n'
  fi
  printf '  网络      %s   IP=%s\n' "${NET_NAME:-无}" "${FIRST_IP:-无}"
  if [[ -n "$BACKREF" ]]; then
    printf '  反代      %s 引用了 %s，compose 会钉死同一 IP，nginx 不用改\n' "$BACKREF" "$FIRST_IP"
  else
    printf '  反代      没搜到引用 %s 的配置（可能在别的路径）\n' "${FIRST_IP:-容器IP}"
  fi
  printf '  代码      %s @ %s\n' "$APP_DIR" "$CODE_VER"
  printf '  磁盘      %s MB 可用\n' "$((AVAIL_KB / 1024))"

  printf '\n【怎么做】\n'
  if [[ "$COMPOSE_MANAGED" -eq 1 ]]; then
    printf '  该容器已由 compose 管理，直接跑更新脚本即可：\n\n'
    printf '    cd %s && ./deploy/update.sh\n' "$APP_DIR"
  else
    printf '  当前容器不是 compose 管的，本脚本可一步接管并升级：\n\n'
    printf '    cd %s && ./deploy/diagnose.sh --upgrade\n' "$APP_DIR"
    printf '\n  想先看它要做什么、不实际执行：\n\n'
    printf '    ./deploy/diagnose.sh --plan\n'
  fi

  printf '\n【--upgrade 会依次做 8 步】\n'
  printf '  1  拉代码        git pull --ff-only（网络不通时用 --skip-git 跳过）\n'
  printf '  2  备份数据      %s/one-api.db → %s/\n' "${DATA_HOST:-<数据目录>}" "$BACKUP_DIR"
  printf '  3  记回滚点      当前镜像打上 %s:previous\n' "$IMAGE_TAG"
  printf '  4  构建镜像      docker build -f Dockerfile.cn -t %s:latest\n' "$IMAGE_TAG"
  printf '  5  生成编排      %s（挂载/环境变量按现有容器 1:1 复制，IP 钉死 %s）\n' "$TARGET_FILE" "${FIRST_IP:-同网段}"
  printf '  6  停旧容器      改名为 %s-old-<时间> 并停止（不删除，留着兜底）\n' "$C_NAME"
  printf '  7  启动 + 探活   轮询 http://<容器IP>:%s/api/status 90 秒\n' "$PLAN_PORT"
  printf '  8  校验挂载      确认新容器 /data 仍指向 %s\n' "${DATA_HOST:-原目录}"

  printf '\n【出问题怎么办】\n'
  printf '  · 构建失败  → 脚本直接退出，旧容器一直在跑，服务无中断\n'
  printf '  · 探活失败  → 自动删新容器、把旧的改回原名启动，几十秒恢复\n'
  printf '  · 想手动退  → docker rm -f %s && docker rename %s-old-<时间> %s && docker start %s\n' \
    "$C_NAME" "$C_NAME" "$C_NAME" "$C_NAME"

  if [[ "$COMPOSE_MANAGED" -eq 0 ]]; then
    printf '\n【为什么要接管成 compose】\n'
    printf '  你现在这个容器是 docker run 起的，更新时得手工再敲一遍全部 -e/-v 参数，\n'
    printf '  漏一个 -v 就变成空站。接管后参数固定写在 %s，\n' "$TARGET_FILE"
    printf '  以后每次更新只需 ./deploy/update.sh（自带备份、探活、自动回滚）。\n'
  fi
}

# ---------- 升级执行 ----------
say()  { printf '\033[36m[upgrade]\033[0m %s\n' "$*"; }
swarn(){ printf '\033[33m[warn]\033[0m %s\n' "$*"; }
serr() { printf '\033[31m[fail]\033[0m %s\n' "$*" >&2; }

c_ip() { docker inspect --format '{{range .NetworkSettings.Networks}}{{.IPAddress}} {{end}}' "$1" 2>/dev/null | awk '{print $1}'; }

probe_http() {
  local ip="$1" port="$2" i
  for i in $(seq 1 30); do
    # 优先容器内探活：不依赖宿主机到容器的网络可达性
    if docker exec "$C_NAME" wget -qO- --timeout=2 "http://127.0.0.1:$port/api/status" 2>/dev/null | grep -q '"success":true'; then
      return 0
    fi
    # 兜底：宿主机直接访问容器 IP（镜像里没有 wget 时）
    if [[ -n "$ip" ]] && curl -fsS --max-time 2 "http://$ip:$port/api/status" 2>/dev/null | grep -q '"success":true'; then
      return 0
    fi
    sleep 2
  done
  return 1
}

if docker compose version >/dev/null 2>&1; then DC_CMD="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then DC_CMD="docker-compose"
else DC_CMD=""; fi

do_upgrade() {
  local stamp old_name prev_id db_before m_src new_ip ok st rc ans

  say "开始升级：容器 $C_NAME → $IMAGE_TAG:latest"

  # --- 前置检查（任何一条不过就直接退出，不碰现有容器）---
  [[ -n "$DC_CMD" ]] || { serr "没有 docker compose，先装：apt install docker-compose-plugin"; return 1; }
  [[ -d "$APP_DIR/.git" ]] || { serr "代码目录不是 git 仓库：$APP_DIR"; serr "先拉代码：git clone git@github.com:yamomo1/new-api-gallery.git $APP_DIR"; return 1; }
  [[ -f "$APP_DIR/Dockerfile.cn" ]] || { serr "缺少 $APP_DIR/Dockerfile.cn，代码不完整"; return 1; }
  if [[ -z "$DB_FILE" && -z "$SQL_DSN_VAL" ]]; then
    serr "既没有挂载出来的数据库文件，也没配 SQL_DSN —— 数据可能在容器内部，重建会全丢"
    serr "请先把数据目录挂载出来，再升级"
    return 1
  fi
  if [[ "$AVAIL_KB" -lt 8388608 ]]; then
    swarn "根分区只剩 $((AVAIL_KB / 1024)) MB，构建镜像建议留 8G 以上"
  fi

  if [[ "$COMPOSE_MANAGED" -eq 1 ]]; then
    say "该容器已由 compose 管理，交给 update.sh"
    exec "$APP_DIR/deploy/update.sh"
  fi

  # --- 执行前确认 ---
  if [[ "$ASSUME_YES" -ne 1 ]]; then
    if [[ -t 0 ]]; then
      printf '\n即将重建容器 %s：\n' "$C_NAME"
      printf '  · 数据目录 %s 只挂载，不重建\n' "${DATA_HOST:-（见报告第 4 段）}"
      printf '  · 旧容器改名为 %s-old-<时间>，不删除\n' "$C_NAME"
      printf '  · 探活失败会自动切回旧容器\n'
      printf '输入 yes 继续：'
      read -r ans
      [[ "$ans" == "yes" ]] || { say "已取消，什么都没改"; return 1; }
    else
      serr "非交互环境请加 --yes"
      return 1
    fi
  fi

  stamp="$(date +%Y%m%d-%H%M%S)"
  old_name="${C_NAME}-old-${stamp}"

  # --- 1 拉代码 ---
  say "1/8 更新代码"
  if [[ "$SKIP_GIT" -eq 1 ]]; then
    say "  --skip-git，跳过"
  else
    if git -C "$APP_DIR" rev-parse --git-dir >/dev/null 2>&1; then
      if ! git -C "$APP_DIR" pull --ff-only origin "${BRANCH:-gallery-fork}" 2>&1 | tail -3; then
        swarn "  git pull 失败（本地有改动或网络不通），改用当前代码继续"
        swarn "  如确认代码已是最新，可下次加 --skip-git"
      fi
    else
      swarn "  不是 git 仓库，跳过"
    fi
  fi

  # --- 2 备份数据 ---
  say "2/8 备份数据"
  mkdir -p "$BACKUP_DIR" || { serr "创建备份目录失败：$BACKUP_DIR"; return 1; }
  db_before=""
  if [[ -n "$DB_FILE" && -f "$DB_FILE" ]]; then
    db_before="$(stat -c %s "$DB_FILE" 2>/dev/null || echo 0)"
    cp -a "$DB_FILE" "$BACKUP_DIR/one-api.db.${stamp}.bak" \
      && say "  $(basename "$DB_FILE") $(du -h "$DB_FILE" | cut -f1) → $BACKUP_DIR/one-api.db.${stamp}.bak" \
      || { serr "备份失败，已中止（现有容器未动）"; return 1; }
  else
    swarn "  数据库在外部（SQL_DSN），本脚本不备份；确认你已有 pg_dump/mysqldump 策略"
  fi
  # 只保留最近 10 份：find 限定目录+文件类型，不依赖 glob（空 glob 会让 ls 列当前目录）
  if [[ -d "$BACKUP_DIR" ]]; then
    find "$BACKUP_DIR" -maxdepth 1 -type f -name 'one-api.db.*.bak' -printf '%T@\t%p\n' 2>/dev/null \
      | sort -rn \
      | awk 'NR > 10 { sub(/^[^\t]*\t/, ""); print }' \
      | xargs -r rm -f --
  fi

  # --- 3 回滚点 ---
  say "3/8 记录回滚点"
  prev_id="$(docker inspect --format '{{.Image}}' "$C_NAME" 2>/dev/null)"
  if [[ -n "$prev_id" ]]; then
    docker tag "$prev_id" "${IMAGE_TAG}:previous" 2>/dev/null \
      && say "  ${IMAGE_TAG}:previous ← ${prev_id:7:12}" \
      || swarn "  打标签失败（镜像可能是只读引用），回滚将依赖 $old_name"
  else
    swarn "  取不到当前镜像 ID"
  fi

  # --- 4 构建 ---
  say "4/8 构建镜像 ${IMAGE_TAG}:latest（首次较慢，之后走缓存）"
  if ! ( cd "$APP_DIR" && docker build -f Dockerfile.cn -t "${IMAGE_TAG}:latest" -t "${IMAGE_TAG}:${stamp}" . ); then
    serr "构建失败。现有容器未动，服务仍是旧版本"
    return 1
  fi
  say "  构建完成"

  # --- 5 生成编排 ---
  say "5/8 生成编排文件"
  mkdir -p "$TARGET_DIR"
  if [[ -f "$TARGET_FILE" ]]; then
    cp -a "$TARGET_FILE" "$TARGET_FILE.bak.${stamp}" && say "  旧编排已备份 → $TARGET_FILE.bak.${stamp}"
  fi
  if ! gen_compose 0 > "$TARGET_FILE"; then
    serr "写编排失败：$TARGET_FILE"
    return 1
  fi
  chmod 600 "$TARGET_FILE"
  say "  → $TARGET_FILE（600，含真实密钥）"

  # --- 6 停旧容器（改名保留） ---
  say "6/8 停旧容器（保留，不删除）"
  if ! docker rename "$C_NAME" "$old_name"; then
    serr "容器改名失败，已中止（现有容器未动）"
    return 1
  fi
  docker stop "$old_name" >/dev/null 2>&1 || true
  say "  $C_NAME → $old_name"

  # --- 7 启动 + 探活 ---
  say "7/8 启动新容器"
  if ! $DC_CMD -f "$TARGET_FILE" up -d; then
    serr "启动失败，开始回滚"
    $DC_CMD -f "$TARGET_FILE" down >/dev/null 2>&1 || true
    docker rename "$old_name" "$C_NAME" 2>/dev/null || true
    docker start "$C_NAME" >/dev/null 2>&1 || true
    serr "已切回旧容器，请查看：docker logs --tail=100 $C_NAME"
    return 1
  fi

  new_ip="$(c_ip "$C_NAME")"
  say "  探活 http://$new_ip:$PLAN_PORT/api/status"
  ok=0
  if probe_http "$new_ip" "$PLAN_PORT"; then
    ok=1
  else
    st="$(docker inspect --format '{{.State.Status}}' "$C_NAME" 2>/dev/null)"
    rc="$(docker inspect --format '{{.RestartCount}}' "$C_NAME" 2>/dev/null)"
    serr "  探活 60 秒未通过（容器状态 ${st:-未知}，重启 ${rc:-?} 次）"
  fi

  if [[ "$ok" -ne 1 ]]; then
    serr "探活失败，自动回滚"
    $DC_CMD -f "$TARGET_FILE" logs --tail=60 2>/dev/null || docker logs --tail=60 "$C_NAME" 2>/dev/null || true
    $DC_CMD -f "$TARGET_FILE" down >/dev/null 2>&1 || true
    docker rename "$old_name" "$C_NAME" 2>/dev/null || true
    docker start "$C_NAME" >/dev/null 2>&1 || true
    sleep 5
    if probe_http "$(c_ip "$C_NAME")" "$PLAN_PORT"; then
      swarn "已回滚，旧容器恢复运行。新版本问题请查上面的日志"
    else
      serr "回滚后仍不通，请立刻手动介入：docker logs --tail=200 $C_NAME"
    fi
    return 1
  fi

  # --- 8 校验挂载 ---
  say "8/8 校验数据挂载"
  if [[ -n "$DATA_HOST" ]]; then
    m_src="$(docker inspect --format '{{range .Mounts}}{{if eq .Destination "/data"}}{{.Source}}{{end}}{{end}}' "$C_NAME" 2>/dev/null)"
    if [[ "$m_src" != "$DATA_HOST" ]]; then
      serr "新容器 /data 指向 [$m_src]，与原来的 [$DATA_HOST] 不一致 —— 很可能是空站"
      serr "已保留两个容器，请人工核对后再决定删除哪个"
      return 1
    fi
    say "  /data → $DATA_HOST（与升级前一致）"
    if [[ -n "$db_before" && "$db_before" != "0" ]]; then
      local now_size
      now_size="$(stat -c %s "$DB_FILE" 2>/dev/null || echo 0)"
      if [[ "$now_size" -lt $((db_before / 2)) ]]; then
        serr "数据库文件从 $db_before 缩到 $now_size 字节，异常，请立刻检查"
        return 1
      fi
      say "  数据库 $(($now_size / 1024)) KB（升级前 $(($db_before / 1024)) KB）"
    fi
  fi

  say "升级完成"
  printf '  容器    %s\n' "$C_NAME"
  printf '  镜像    %s:latest\n' "$IMAGE_TAG"
  printf '  访问    http://%s:%s\n' "$new_ip" "$PLAN_PORT"
  printf '  旧容器  %s（确认没问题后再删：docker rm %s）\n' "$old_name" "$old_name"
  printf '  备份    %s/one-api.db.%s.bak\n' "$BACKUP_DIR" "$stamp"
  printf '\n  以后更新： cd %s && ./deploy/update.sh\n' "$APP_DIR"
  return 0
}

plan_upgrade

if [[ "$DO_UPGRADE" -eq 1 ]]; then
  printf '\n'
  if do_upgrade; then exit 0; else exit 1; fi
fi

if [[ "$DO_PLAN" -eq 1 ]]; then exit 0; fi

printf '\n诊断结束。把上面全部内容复制粘贴回去（不要贴 docker-compose.yml 原文件，里面有真口令）。\n'
