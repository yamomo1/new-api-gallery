#!/usr/bin/env bash
#
# 【已废弃】请不要运行本脚本
# ------------------------------------------------------------------
# 本脚本是为「单容器 + SQLite + 数据在 /opt/new-api-gallery/data」的布局写的，
# 与这台服务器的实际形态不符（compose 三容器 + PostgreSQL 在 1Panel 侧）。
# 它曾在生产上误删仓库根目录文件（2026-10-29，两次）。
#
# 请改用：
#     ./deploy/upgrade.sh           升级
#     ./deploy/upgrade.sh --check   只体检
#     ./deploy/upgrade.sh --rollback 回滚
# ------------------------------------------------------------------

printf '\n[废弃] 本脚本不适用于当前部署形态，已停用。\n\n' >&2
printf '  请改用： ./deploy/upgrade.sh --check   （只读体检）\n' >&2
printf '          ./deploy/upgrade.sh           （升级）\n\n' >&2
printf '  说明：本机是 deploy/docker-compose.yml 三容器布局，\n' >&2
printf '        数据库是 1Panel 侧的 PostgreSQL，不在 deploy/data 下。\n\n' >&2
exit 1
