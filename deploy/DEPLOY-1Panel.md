# New API 二开 · 1Panel 部署方案

本仓库是 [QuantumNous/new-api](https://github.com/QuantumNous/new-api) 的公开 fork,叠加了:
**Prompt Gallery**(公开画廊 + 我的作品投稿 + 管理员审核)、**电影感首页**、**站点级主题换肤**。
基于官方 **v1.0.0-rc.46**。

> 前置说明:**1Panel 的"容器 → 编排"只负责编排【已存在的镜像】**,它本身**不执行 `docker build`**。
> 你的二开代码要上线,必须先 `docker build` 出镜像,再让 1Panel 编排引用它。
> 因此本方案 = 「shell 构建镜像」+「1Panel 编排 + 反代」两步。

---

## 第 1 步:服务器上构建二开镜像(shell)

在 1Panel 左侧菜单 **主机 → 终端**(或 SSH)执行:

```bash
# 选一个目录放源码,例如 /opt/new-api-gallery
mkdir -p /opt/new-api-gallery && cd /opt/new-api-gallery

# 拉取你的 fork(SSH 需先配好该服务器的 GitHub 访问;或用 HTTPS + token)
git clone git@github.com:yamomo1/new-api-gallery.git .

# 构建镜像(含你的二开前端/后端,产出 local image:new-api-gallery:latest)
docker build -t new-api-gallery:latest .

docker images | grep new-api-gallery   # 确认已生成
```

> 首次构建会拉 bun/go 基础层,较慢;之后增量很快。
> 构建环境说明:官方 `Dockerfile` 自动用 bun 编前端 + go1.26.10 编后端,无需你在 1Panel 装任何构建工具。

## 第 2 步:1Panel 创建编排

> **两种选法,取决于 PostgreSQL / Redis 装在哪:**
> - **方案甲(内置,最省心)**:PG/Redis 跟 app 放在同一编排里 → 用 `docker-compose.1panel.yml`(3 容器),替换 4 个口令占位符。
> - **方案乙(商店装,你要的)**:PG/Redis 用 1Panel「应用商店」单独一键装,app 只编排 1 个容器 → 用 `docker-compose.1panel-external-db.yml`,通过 `host.docker.internal` 连到商店里的 PG/Redis(见下方「替代:DB/缓存交给 1Panel 应用商店」)。

### 方案甲:内置(默认)

1. 左侧菜单 **容器 → 编排 → 创建编排**。
2. 文件夹名称填 `new-api-gallery`,来源默认「编辑」。
3. 把本仓库 `deploy/docker-compose.1panel.yml` 的内容**粘贴**进编辑框。
4. **替换 4 个口令占位符**:`<PG_PASS>`、`<REDIS_PASS>`、`<SESSION_SECRET>`、`<CRYPT_KEY>`。
   在终端生成:
   ```bash
   openssl rand -hex 16   # PG_PASS / REDIS_PASS
   openssl rand -hex 32   # SESSION_SECRET / CRYPT_KEY
   ```
   > ⚠️ 这 4 个值**务必记录保存**:`CRYPT_KEY` 丢失会导致数据库里已存的 API Key 无法解密;
   > `POSTGRES_PASSWORD` 一旦写进编排首次启动,后续不可随意改(改了要连同数据库一起重置)。
5. 点 **确认/创建** → 1Panel 会自动 `docker compose up`,生成编排。
6. 编排目录实际落在:`/opt/1panel/apps/docker/compose/new-api-gallery/`(1Panel 路径,`./data`、`./logs` 相对它)。

### 方案乙:DB/缓存交给 1Panel 应用商店(你要求的"用 1Panel 装这两个容器")

**可以。** 1Panel 应用商店有一键装 PostgreSQL / Redis 的应用。做法:把 DB/缓存拆出 app,商店里装好并**映射端口到宿主机**,app 容器用 `host.docker.internal` 连过去。

1. **1Panel → 应用商店 → 安装 PostgreSQL**:
   - 安装时**勾选「端口映射到宿主机」**(默认 `5432`,若被占用可改成 `15432`)。记下这个宿主端口 = `<PG_HOST_PORT>`。
   - 设 root 口令(`<PG_PASS>`)。
   - **预建库** `new-api`(New API 用 GORM 自动建表,但库本身要先存在;商店装完若没建库,进 **数据库 → PostgreSQL** 建一个库名 `new-api`)。
2. **1Panel → 应用商店 → 安装 Redis**:
   - 同样**映射端口到宿主机**(默认 `6379`,占用可改 `16379`)= `<REDIS_HOST_PORT>`,并设 `requirepass`(`<REDIS_PASS>`)。
3. **1Panel → 容器 → 编排 → 创建编排**(文件夹名可叫 `new-api-gallery-app`):
   - 粘贴 `deploy/docker-compose.1panel-external-db.yml`。
   - 替换占位符:`<PG_PASS>`、`<PG_HOST_PORT>`、`<REDIS_PASS>`、`<REDIS_HOST_PORT>`、`<SESSION_SECRET>`、`<CRYPT_KEY>`。
   - 该文件已内置 `extra_hosts: host.docker.internal:host-gateway`,让 app 容器能经宿主机访问商店的 PG/Redis。
4. 点创建 → 只有 **1 个 app 容器** 起来(DB/Redis 是商店那 2 个,分开管理)。

> 这样备份/升级 DB 直接用 1Panel 商店自带功能,更省事;代价是 `host.docker.internal` 多一跳,且要记 2 个宿主端口。
> **方案乙里的 3 个容器**:`new-api-gallery`(app)+ 商店装的 `PostgreSQL` + `Redis`。
> 二开代码更新方法不变:shell `git pull && docker build -t new-api-gallery:latest .` → 1Panel **容器 → 编排 → new-api-gallery-app → 「重建」**。

### 方案丙:共享 1Panel 网络直连(你现在的实际环境,最干净)★推荐

你的 1Panel 里所有容器都接在同一 docker 网络 `1panel-network`,应用商店装的 PostgreSQL / Redis 也在其中——那就让 app 编排**加入 `1panel-network`**,直接按**容器名**直连,**既不用 `host.docker.internal`、也不用给 PG/Redis 映射宿主端口**(更安全)。

**① 先核对网络名 & 容器名**(1Panel → 主机 → 终端 执行):
```bash
# 确认你的 1Panel 共享网络名(默认 1panel-network,若不同以输出为准)
docker network ls | grep -i 1panel
# 列出该网络里的容器名 + 镜像 + 端口,认出 PG 和 Redis 各自的【容器名】
docker ps --filter "network=1panel-network" --format "{{.Names}}\t{{.Image}}\t{{.Ports}}"
```
记下两个容器名(例如 `postgre_sql`、`redis`,**以你实际输出为准**),以及装 PG 时设的 root 口令、装 Redis 时设的 requirepass。

**② 预建库**:1Panel → 数据库 → PostgreSQL → 建库 `new-api`(GORM 只自动建表)。

**③ 1Panel → 容器 → 编排 → 创建编排**(文件夹名 `new-api-gallery-app`):
- 粘贴 `deploy/docker-compose.1panel-sharednet.yml`。
- 该文件已写好 `networks: 1panel-network (external)` 和容器名连接串,你只需替换 6 个占位符:
  `<PG_CONTAINER>`、`<REDIS_CONTAINER>`、`<PG_PASS>`、`<REDIS_PASS>`、`<SESSION_SECRET>`、`<CRYPT_KEY>`。
- 点创建 → 起 1 个 app 容器,与商店的 PG/Redis 同在 `1panel-network` 按容器名互通。

> **务必核对网络名**:compose 里 `1panel-network` 是 `external: true`(只挂载、不新建)。
> 若你的实际网络名不是 `1panel-network`(比如带后缀/大小写不同),要同步改文件里的 `networks:` 段和 service 的 `networks:` 段,否则编排会因网络不存在而启动失败。

> **方案丙里的 3 个容器**:商店装的 `PostgreSQL` + `Redis` + 编排里的 `new-api-gallery`(app),三者同网络、容器名直连。
> 二开代码更新方法同前:shell `git pull && docker build -t new-api-gallery:latest .` → 1Panel **容器 → 编排 → new-api-gallery-app → 「重建」**。

**三方案速记**:甲=3 容器全内置(最省心);乙=商店装 DB + `host.docker.internal`(要映射宿主端口);**丙=商店装 DB + 共享 `1panel-network` 容器名直连(最干净,适配你的环境)★**。

## 第 3 步:验证

- **容器 → 容器** 里应看到 `new-api-gallery` / `-redis` / `-pg` 三个容器在运行。
- 浏览器访问 `http://<服务器IP>:3000`,首次启动稍等(建库建表,含二开 `prompt_gallery` 表)。
- `/api/status` 返回 `"success":true` 即正常;**第一个注册/登录的账号自动成为管理员**。

## 第 4 步(生产):域名 + HTTPS(1Panel 反向代理)

1. 左侧菜单 **网站 → 创建网站 → 反向代理**,域名填你的域名,代理地址填 `http://127.0.0.1:3000`。
2. 在该网站的 **SSL** 里选 **Let's Encrypt**,填邮箱 → 申请证书(域名的 A 记录先解析到本机 IP)。
3. 申请成功后开启 **强制 HTTPS**。
4. **安全加固**:把编排里 `new-api` 的 `3000:3000` 改成 `127.0.0.1:3000`(仅本机),对外只走 443;
   并在编排 environment 增加:
   ```
   - SESSION_COOKIE_SECURE=true
   - SESSION_COOKIE_TRUSTED_URL=https://你的域名
   - TRUSTED_PROXIES=你的反代来源IP/CIDR
   ```
   > 改完点该编排的 **重建** 生效(见第 6 步)。

---

# 更新方法(你问的重点)

分两类:**你改二开代码** 与 **上游发新版**。

## A. 你自己改了代码 / 首页 / 画廊 / 主题(最常见)

**两步:先 build 出新镜像,再让 1Panel 重建编排。**

```bash
# 1) 服务器 pull 最新代码并重新构建镜像(覆盖 new-api-gallery:latest)
cd /opt/new-api-gallery
git pull
docker build -t new-api-gallery:latest .
```

```
# 2) 1Panel → 容器 → 编排 → 找到 new-api-gallery → 操作栏点「重建」
#    重建会:重新拉起编排(容器)。镜像内容已是新的,所以二开功能随之更新。
#    持久化数据(data/logs、pg_data 卷)保留不变。
```

> ⚠️ 关键点:1Panel 的「重建」是**按当前镜像重新跑容器**。
> 所以**必须先 `docker build` 更新镜像**,再点重建;顺序反了不会更新二开代码。
> 若你只想改 `.env`/编排里某个环境变量:直接在 1Panel 编排详情里编辑 → 保存 → 重建即可,无需重新 build。

## B. 上游 New API 发新版(如 rc.46 → rc.47)

在服务器源码目录走 rebase(冲突只会落 3 个集成点),再走 A 的两步:

```bash
cd /opt/new-api-gallery
git fetch upstream
git rebase upstream/v1.0.0-rc.47     # 改成实际新 tag
# 可能冲突的文件(仅这些):
#   router/api-router.go   画廊路由注册
#   model/main.go          AutoMigrate(&PromptGallery{})
#   controller/misc.go     status.Theme 读 ThemePreset
# 解决后 git rebase --continue
docker build -t new-api-gallery:latest .
```
然后 **1Panel 编排点「重建」**。数据库靠 `AutoMigrate` 自动迁移,向后兼容。

> 升级前备份:
> - 镜像/代码:`git tag before-rc47`
> - 数据库:在 1Panel **数据库 → PostgreSQL** 里对 `new-api` 库做备份,或
>   `docker exec new-api-gallery-pg pg_dump -U root new-api > new-api-backup.sql`

## C. 回滚

- 代码:`git checkout <旧tag>` → `docker build` → 1Panel 重建。
- 数据库:用备份 `pg_dump` 恢复(在 1Panel 的 PostgreSQL 里导入,或 `docker exec ... psql -U root new-api < backup.sql`)。

---

## 日常运维速查

| 想做什么 | 在哪操作 |
| --- | --- |
| 看实时日志 | 容器 → 容器 → `new-api-gallery` → 日志 |
| 改环境变量 | 容器 → 编排 → new-api-gallery → 编辑(保存后重建) |
| 停/启 | 容器 → 编排 → 停止/启动 |
| 改二开代码上线 | shell `git pull && docker build` → 1Panel 编排「重建」 |
| 升级上游 | shell `git rebase upstream/<新tag>` → `docker build` → 1Panel「重建」 |
| 备份数据库 | 1Panel 数据库 → PostgreSQL → 备份,或 pg_dump |
| 改 HTTPS/域名 | 网站 → 反向代理 + SSL |

## 目录与数据

- 编排文件:`/opt/1panel/apps/docker/compose/new-api-gallery/docker-compose.yml`(1Panel 生成)
- 你的源码 + Dockerfile:建议放 `/opt/new-api-gallery/`(与编排目录分开,便于 `git pull`)
- 应用数据:编排目录的 `./data`、`./logs`;Postgres 数据在命名卷 `pg_data`

## AGPL 合规

New API 为 **AGPL-3.0**,本 fork 已公开托管于
[github.com/yamomo1/new-api-gallery](https://github.com/yamomo1/new-api-gallery),
站点页脚已带「源码」链接指向该仓库(并保留上游署名),满足源码提供义务。
