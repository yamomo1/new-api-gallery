# 本地开发环境搭建（与线上尽量一致）

目标：在本地改代码、看效果、抓 bug，满意后再推服务器。全程不碰生产数据，只同步 `options` 配置表。

## 为什么本地和线上「看起来不一样」

| 差异来源 | 本地默认 | 线上 | 解决 |
|---|---|---|---|
| 数据库方言 | SQLite | PostgreSQL | 本地也用 PostgreSQL |
| 配置(options) | 空库=代码默认值 | 你配过的 | 同步 `options` 表（一次性） |
| 业务数据 | 空 | 真实数据 | **不用同步**，本地自己造测试数据 |

> 站点名 `一幕AI`、SEO、导航、水印等**都存在 `options` 表**，不在代码里。所以只要把这张表从生产灌到本地，本地界面就和线上一致了，且不需要任何业务数据。

## 步骤一：本地起 PostgreSQL + Redis

最省事的方式（需装 Docker Desktop）：

```bash
docker run -d --name dev-pg -p 5432:5432 \
  -e POSTGRES_PASSWORD=localdev -e POSTGRES_DB=new-api postgres:15

docker run -d --name dev-redis -p 6379:6379 \
  redis:7 redis-server --requirepass localdev
```

（不想用 Docker 也可装本地 PostgreSQL / Redis，连接串照填即可。）

## 步骤二：准备连接串

```bash
cd new-api-src/deploy
cp .sync-env.example .sync-env      # 编辑 .sync-env，填 PROD_DSN 与 LOCAL_DSN
```

- `LOCAL_DSN`：上面 docker 起的库 → `postgresql://postgres:localdev@localhost:5432/new-api`
- `PROD_DSN`：取服务器 `deploy/.env` 里的 `SQL_DSN`
  - 若本地能直连 1Panel 的 PostgreSQL，直接填它；
  - 若不能直连，用「方式二」先导出再拷回（见下）。

## 步骤三：首次拉取生产配置（让本地界面=线上）

1. 先把本地库建表：用 `local.env.example` 起一次应用（或 `go build` 出本地二进制运行），让 AutoMigrate 自动建好 `options` 等表。
2. 然后一条命令同步配置：

```bash
./dev-sync-options.sh pull
```

此后本地界面（站名/导航/SEO/水印）就和线上一致了。

> **之后基本不用再导。** 只有「你在线上后台改了配置、且想让本地也跟着变」时才再跑一次 `pull`。业务数据（作品/用户）永远不需要导。

## 步骤四：日常开发

- 后端：改完 `go build -o new-api-local.exe .`（或 `go run`）后用 `local.env` 启动。
- 前端：用 `bun` 构建 `web/dist`；需要热更新时单独起前端 dev server（后续可配置 API 代理到本地后端）。
- 联调时浏览器访问本地 `:3000`。

## 步骤五：本地满意后推服务器

```bash
git push origin gallery-fork
# 服务器执行唯一升级入口
cd /opt/new-api-gallery/new-api-gallery && ./deploy/upgrade.sh
```

## 若你在本地调好了「导航/SEO 配置」想推到线上

不用去后台点点点，直接：

```bash
./dev-sync-options.sh push     # 会用本地 options 覆盖生产 options（有二次确认+自动备份）
```

## 方式二：本地无法直连生产库时

1. 在 1Panel 的 PostgreSQL 终端执行：
   ```sql
   \copy (SELECT key, value FROM options) TO '/tmp/options.csv' CSV HEADER;
   ```
   或用 1Panel 的「导出」功能把 `options` 表导出为 SQL。
2. 把文件拷回本地，手动导入本地库：
   ```bash
   psql "$LOCAL_DSN" -c "TRUNCATE options;"
   psql "$LOCAL_DSN" -c "\copy options(key,value) FROM '/tmp/options.csv' CSV HEADER;"
   ```
   （或用 1Panel 导出的 SQL 文件 `psql "$LOCAL_DSN" -f options.sql`）

## 安全提示

- `.sync-env` 含数据库口令，已被 `.gitignore` 忽略，**切勿提交**。
- `push` 会覆盖生产配置，脚本已强制二次确认并自动备份到 `/tmp`，回滚用备份文件即可。
- 任何同步都只动 `options` 表，绝不碰 `prompt_galleries` / `users` 等业务表。
