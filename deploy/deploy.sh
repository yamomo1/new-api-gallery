#!/usr/bin/env bash
# New API 二开 (gallery-fork) 一键部署脚本
# 用法: 克隆仓库后执行  bash deploy/deploy.sh
# 依赖: docker + docker compose v2、openssl
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

# ---- 依赖检查 ----
for c in docker openssl; do
  command -v "$c" >/dev/null 2>&1 || { echo "错误: 缺少命令 $c"; exit 1; }
done
DC="docker compose"
docker compose version >/dev/null 2>&1 || DC="docker-compose"
echo "使用 compose: $DC"

# ---- 生成 .env(已存在则跳过,避免重置数据库密码) ----
if [ ! -f ".env" ]; then
  PG_PASS="$(openssl rand -hex 12)"
  REDIS_PASS="$(openssl rand -hex 12)"
  SESSION_SECRET="$(openssl rand -hex 32)"
  CRYPT_KEY="$(openssl rand -hex 32)"
  cat > .env <<EOF
# 基础设施口令
POSTGRES_PASSWORD=${PG_PASS}
REDIS_PASSWORD=${REDIS_PASS}

# New API 应用配置
SQL_DSN=postgresql://root:${PG_PASS}@postgres:5432/new-api
REDIS_CONN_STRING=redis://:${REDIS_PASS}@redis:6379
SESSION_SECRET=${SESSION_SECRET}
CRYPT_KEY=${CRYPT_KEY}
TZ=Asia/Shanghai
PORT=3000
ERROR_LOG_ENABLED=true
DEFAULT_LANGUAGE=zh-CN
EOF
  chmod 600 .env
  echo "已生成 deploy/.env(含随机密码,请妥善保存)"
else
  echo "检测到已有 deploy/.env,跳过生成(避免重置数据库密码)"
fi

# ---- 构建镜像并启动 ----
$DC -f docker-compose.yml up -d --build
$DC -f docker-compose.yml ps
echo ""
echo "================ 部署完成 ================"
echo "访问: http://<服务器IP>:3000"
echo "首次启动会自动建库建表(含二开新增的 prompt_gallery 表)。"
echo "New API 首个注册的账号自动成为管理员。"
echo ""
echo "常用命令:"
echo "  查看日志:  $DC -f docker-compose.yml logs -f new-api"
echo "  停止:      $DC -f docker-compose.yml down"
echo "  重建上线:  $DC -f docker-compose.yml up -d --build"
