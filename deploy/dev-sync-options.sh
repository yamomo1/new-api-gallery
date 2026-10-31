#!/usr/bin/env bash
# ============================================================================
# dev-sync-options.sh —— 本地 ↔ 生产 仅同步「options 配置表」
# ----------------------------------------------------------------------------
# 用途：让本地开发环境与线上「看起来一样」，又尽量不碰生产数据。
#       options 表只存站点配置（站名/SEO/导航/水印等），不含任何业务数据，
#       所以同步它既安全又能让本地界面与线上一致。
#
# 用法：
#   ./dev-sync-options.sh pull          # 生产配置 → 覆盖本地（建本地环境时跑一次）
#   ./dev-sync-options.sh push          # 本地配置 → 覆盖生产（本地调好导航/SEO 后推上去）
#   ./dev-sync-options.sh check         # 只打印两端 options 行数，不做任何改动
#   ./dev-sync-options.sh pull  --force # 跳过确认（CI/脚本内使用）
#
# 连接串来源（按顺序）：命令行参数 > 环境变量 > ./deploy/.sync-env
#   PROD_DSN   生产库连接串（服务器 deploy/.env 里的 SQL_DSN）
#   LOCAL_DSN  本地库连接串（你本机起的 PostgreSQL）
#
# 安全：
#   - 任何覆盖操作前，都会先把「目标库」的 options 备份到 /tmp
#   - push（写生产）会要求二次确认，除非带 --force
#   - 若 PROD_DSN 与 LOCAL_DSN 相同，直接拒绝，防止误覆盖自己
# ============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ---- 加载连接串 ----------------------------------------------------------
if [ -f "$SCRIPT_DIR/.sync-env" ]; then
  set -a; . "$SCRIPT_DIR/.sync-env"; set +a
fi

MODE="${1:-}"
FORCE=0
if [ "${2:-}" = "--force" ] || [ "${3:-}" = "--force" ]; then FORCE=1; fi

# ---- 帮助 / 未知模式（先于连接串校验，便于无配置时也能看帮助）--------------
case "$MODE" in
  ""|-h|--help|help)
    sed -n '3,30p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
    exit 0
    ;;
esac

# ---- 工具检查 ------------------------------------------------------------
for bin in psql pg_dump; do
  if ! command -v "$bin" >/dev/null 2>&1; then
    echo "❌ 缺少命令：$bin（请安装 PostgreSQL 客户端，或确保 PATH 里有 psql/pg_dump）" >&2
    exit 1
  fi
done

# ---- 参数校验 ------------------------------------------------------------
if [ -z "${PROD_DSN:-}" ] || [ -z "${LOCAL_DSN:-}" ]; then
  echo "❌ 未配置 PROD_DSN / LOCAL_DSN。" >&2
  echo "   复制 deploy/.sync-env.example 为 deploy/.sync-env 并填写，或 export 这两个变量。" >&2
  exit 1
fi
if [ "$PROD_DSN" = "$LOCAL_DSN" ]; then
  echo "❌ PROD_DSN 与 LOCAL_DSN 相同，拒绝执行（防止把库覆盖自己）。" >&2
  exit 1
fi

# ---- 辅助函数 ------------------------------------------------------------
rowcount() {
  psql "$1" -tAc "SELECT count(*) FROM public.options;" 2>/dev/null || echo "?"
}
table_exists() {
  psql "$1" -tAc "SELECT 1 FROM public.options LIMIT 1;" >/dev/null 2>&1
}
dump_options() {
  # $1=源 DSN  $2=输出文件
  pg_dump "$1" \
    --table=public.options \
    --schema=public \
    --data-only \
    --column-inserts \
    --no-owner --no-privileges --no-comments \
    -f "$2"
}
backup_target() {
  # $1=目标 DSN  输出备份文件路径
  local bk; bk="$(mktemp /tmp/options_backup_XXXXXX.sql)"
  pg_dump "$1" --table=public.options --schema=public --data-only --column-inserts \
    --no-owner --no-privileges --no-comments -f "$bk"
  echo "$bk"
}
restore_to() {
  # $1=目标 DSN  $2=待导入的 dump 文件
  psql "$1" -v ON_ERROR_STOP=1 -c "TRUNCATE TABLE public.options;"
  psql "$1" -v ON_ERROR_STOP=1 -f "$2"
}

# ---- 模式分发 ------------------------------------------------------------
case "$MODE" in
  check)
    echo "生产 options 行数 : $(rowcount "$PROD_DSN")"
    echo "本地 options 行数 : $(rowcount "$LOCAL_DSN")"
    exit 0
    ;;

  pull)
    SRC="$PROD_DSN";  TGT="$LOCAL_DSN"
    SRC_LABEL="生产"; TGT_LABEL="本地"
    ;;

  push)
    SRC="$LOCAL_DSN"; TGT="$PROD_DSN"
    SRC_LABEL="本地"; TGT_LABEL="生产"
    ;;

  *)
    echo "❌ 未知模式：$MODE（可用 pull / push / check）" >&2
    exit 1
    ;;
esac

# ---- 前置检查：目标库必须已建表（先启动一次应用让 AutoMigrate 建表）--------
if ! table_exists "$TGT"; then
  echo "❌ 目标库（${TGT_LABEL}）还没有 options 表。" >&2
  echo "   请先启动一次应用（或运行迁移）让它自动建表，再执行本脚本。" >&2
  exit 1
fi

DUMP="$(mktemp /tmp/options_dump_XXXXXX.sql)"

echo "════════════════════════════════════════════════════════════"
echo " 模式      : $MODE"
echo " 源(${SRC_LABEL}) : ${SRC%%:*}://***@${SRC#*@}"
echo " 目标(${TGT_LABEL}): ${TGT%%:*}://***@${TGT#*@}"
echo "════════════════════════════════════════════════════════════"

# push 写生产：二次确认
if [ "$MODE" = "push" ] && [ "$FORCE" -ne 1 ]; then
  read -r -p "⚠️  即将用【本地】配置覆盖【生产】options，确认？(输入 YES 继续) " ans
  if [ "$ans" != "YES" ]; then
    echo "已取消。"; rm -f "$DUMP"; exit 0
  fi
fi

echo "① 导出源(${SRC_LABEL}) options ..."
dump_options "$SRC" "$DUMP"
echo "   源行数: $(wc -l < "$DUMP") 条 INSERT"

echo "② 备份目标(${TGT_LABEL}) options -> /tmp ..."
BACKUP="$(backup_target "$TGT")"
echo "   备份文件: $BACKUP"

echo "③ 覆盖目标(${TGT_LABEL}) options ..."
restore_to "$TGT" "$DUMP"

echo "④ 校验：目标(${TGT_LABEL}) options 行数 = $(rowcount "$TGT")"
rm -f "$DUMP"
echo "✅ 完成。若需回滚，用备份文件恢复：psql \"$TGT\" -f $BACKUP"
