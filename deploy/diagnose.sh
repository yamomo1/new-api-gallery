#!/usr/bin/env bash
#
# new-api 现状诊断（只读，不改任何东西）
# ------------------------------------------------------------------
# 作用：把服务器上正在跑的 new-api 摸清楚，输出一份可以直接粘贴给 AI/同事的报告，
#       并顺带打印一份「按你当前容器 1:1 生成」的 compose 草稿。
#
# 用法：
#   ./deploy/diagnose.sh               自动找 new-api 容器，只输出报告（口令已脱敏）
#   ./deploy/diagnose.sh <容器名>       指定容器
#   ./deploy/diagnose.sh --write        额外把 compose 写到 /opt/new-api-gallery/docker-compose.yml
#                                       （文件里是真实口令，报告里仍然脱敏）
#
# 安全：默认全只读。SESSION_SECRET / CRYPT_KEY / 数据库口令在报告里脱敏成 *** (len=64, head=ab12)。
# ------------------------------------------------------------------

set -uo pipefail

C_NAME=""
WRITE=0
for arg in "$@"; do
  case "$arg" in
    --write|-w) WRITE=1 ;;
    -h|--help) sed -n '2,20p' "$0"; exit 0 ;;
    *) C_NAME="$arg" ;;
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
APP_DIR="/opt/new-api-gallery/new-api-gallery"
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

printf '\n诊断结束。把上面全部内容复制粘贴回去（不要贴 docker-compose.yml 原文件，里面有真口令）。\n'
