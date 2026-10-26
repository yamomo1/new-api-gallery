# New API 二开 (gallery-fork) 部署手册

本仓库是 [QuantumNous/new-api](https://github.com/QuantumNous/new-api) 的公开 fork,在官方 New API 之上叠加了:

- **Prompt Gallery**:公开画廊浏览/筛选、我的作品(投稿)、管理员审核后台
- **电影感首页**(gallery-home):Hero 视频 / Ticker / 模型轮播
- **站点级主题换肤**:后台可下发 `ThemePreset`,前端用户未手动选择时跟随站点默认

> 代码基于官方 **v1.0.0-rc.46**。二开改动集中在 3 个上游集成点(见文末),升级时只需 rebase。

---

## 1. 前置要求(服务器)

- **Docker 20.10+** 与 **Docker Compose v2**(`docker compose version` 能出结果即可)
- 端口 **3000** 开放(如需对外,建议配反向代理 + HTTPS,见 §5)
- 磁盘 ≥ 2GB,内存 ≥ 1GB

> 本 fork 的镜像**必须从仓库内 `Dockerfile` 构建**(含你的二开前端/后端),**不要**用上游官方镜像
> `calciumion/new-api:latest` —— 那个不含画廊/首页/主题代码。

## 2. 快速部署(推荐)

```bash
# 1) 克隆你的 fork(走 SSH 或 HTTPS 均可)
git clone git@github.com:yamomo1/new-api-gallery.git
cd new-api-gallery

# 2) 一键构建 + 启动(自动生成随机 .env,构建镜像,拉起 postgres+redis+app)
bash deploy/deploy.sh
```

- 浏览器访问 `http://<服务器IP>:3000`
- **首次启动**会自动建库、建表(含二开新增的 `prompt_gallery` 表),并生成**首个管理员账号 = 你注册/登录的第一个账号**。
- 首次启动较慢(数据库初始化),稍等再看 `/api/status` 是否 `"success":true`。

> 若你的环境没有 `docker compose`(v2)子命令,`deploy.sh` 会自动回退到 `docker-compose`(v1),二者皆可。

## 3. 手动部署(等价步骤,便于排错)

```bash
cd new-api-gallery/deploy

# 生成 .env(含随机口令);也可手工复制 .env.example 为 .env 并替换 CHANGE_ME
[ -f .env ] || openssl rand -hex 12   # 自行生成密码,填入 .env

docker compose -f docker-compose.yml up -d --build
docker compose -f docker-compose.yml logs -f new-api
```

## 4. 配置要点(deploy/.env)

| 变量 | 说明 |
| --- | --- |
| `POSTGRES_PASSWORD` / `REDIS_PASSWORD` | 基础设施口令,脚本随机生成;compose 里变量插值与容器 env 共用同一 `.env` |
| `SQL_DSN` | `postgresql://root:<同上口令>@postgres:5432/new-api` |
| `REDIS_CONN_STRING` | `redis://:<同上口令>@redis:6379` |
| `SESSION_SECRET` | 多节点/安全场景务必设为 64 位随机 hex;**单机不共享也可,但强烈建议设置** |
| `CRYPT_KEY` | 加解密数据库里存储的 API Key(64 位 hex)。**必须固定保存**,丢失将导致已存 Key 无法解密 |
| `DEFAULT_LANGUAGE` | `zh-CN` / `en` / `zh-TW`,缺省 `en` |

> ⚠️ `deploy/.env` 内含口令与密钥,**不要提交进 Git**(已在 `.gitignore`)。

## 5. 生产安全加固(上线前必做)

1. **HTTPS**:在前面套 Nginx/Caddy 反代到 `localhost:3000`,并把
   `deploy/docker-compose.yml` 的 `3000:3000` 端口绑定改为 `127.0.0.1:3000`(仅本机),由反代对外暴露 443。
   反代配置示意(Nginx):
   ```nginx
   server {
     listen 443 ssl http2;
     server_name your-domain.com;
     ssl_certificate     /etc/ssl/your.fullchain;
     ssl_certificate_key /etc/ssl/your.priv;
     location / {
       proxy_pass http://127.0.0.1:3000;
       proxy_set_header Host $host;
       proxy_set_header X-Real-IP $remote_addr;
       proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       proxy_set_header X-Forwarded-Proto https;
       proxy_set_header X-Forwarded-Host $host;
       proxy_buffering off;            # 流式推理
       proxy_read_timeout 300s;
       client_max_body_size 50M;
     }
   }
   ```
2. **会话 Cookie(HTTPS 后建议开启)**:在 `deploy/.env` 增加
   ```
   SESSION_COOKIE_SECURE=true
   SESSION_COOKIE_TRUSTED_URL=https://your-domain.com
   TRUSTED_PROXIES=your.proxy.ip 或 CIDR   # 反代来源
   ```
3. **改默认口令**:`deploy.sh` 已随机生成;若手工 `.env`,务必把 `CHANGE_ME` 全部替换。
4. **备份**:定期 `pg_dump`(容器内 `postgres` 服务)与 `redis` dump,同时保存好 `deploy/.env`。

## 6. 升级(上游发新版时)

本 fork 45/48 改动是新增文件,**升级只需 rebase 上游**,冲突集中在 3 个集成点:

```bash
git fetch upstream
git checkout gallery-fork
git rebase upstream/v1.0.0-rc.XX     # 替换为新 tag
# 若冲突,只会落在下列 3 处:
#   router/api-router.go   —— 画廊路由组注册
#   model/main.go          —— AutoMigrate(&PromptGallery{})
#   controller/misc.go     —— status.Theme 读 OptionMap["ThemePreset"]
git rebase --continue
git push origin gallery-fork
```

服务器上重新构建即可(数据库靠 `AutoMigrate` 自动迁移,向后兼容):

```bash
cd new-api-gallery && git pull
bash deploy/deploy.sh        # 或 docker compose -f deploy/docker-compose.yml up -d --build
```

> 建议**钉版本**:仅在有新安全/CVE 修复或确实需要的功能时才升级,降低维护频率。

## 7. 回滚

- 升级前打锚点 tag:`git tag gallery-fork/before-rcXX`
- 数据库先备份:`docker compose -f deploy/docker-compose.yml exec postgres pg_dump -U root new-api > backup.sql`
- 出问题:`git checkout <旧tag>` → 重新构建部署 → 必要时恢复 `backup.sql`

## 8. 数据目录

- 应用数据 / SQLite(若用)在容器卷 `./data`(挂载 `/data`)
- 日志在 `./logs`(挂载 `/app/logs`)
- 使用 Postgres 时数据在命名卷 `pg_data`

## 9. AGPL 合规

New API 为 **AGPL-3.0**。本 fork 已公开托管于
[github.com/yamomo1/new-api-gallery](https://github.com/yamomo1/new-api-gallery),
站点页脚已附「源码」链接指向该仓库(同时保留上游 New API 署名),满足源码提供义务。
