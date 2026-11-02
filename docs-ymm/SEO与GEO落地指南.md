# 一幕AI · SEO 与 GEO 落地指南

> GEO = Generative Engine Optimization，即「让 ChatGPT / Claude / Perplexity / 豆包 / 夸克 这些 AI 搜索能看见你、引用你」。
> 一句话：**传统 SEO 讨好爬虫，GEO 讨好不会执行 JS 的爬虫 + 爱引用的模型。**

---

## 一、这次做了什么（代码已生效）

### 1. 服务端注入（最关键的一步）

前端是纯 SPA，构建出来的 `index.html` 只有一个空 `<div id="root">`。
Google 会执行 JS，但 **GPTBot / ClaudeBot / PerplexityBot / CCBot 不会** ——
它们看到的就是那张空壳。所以在 Go 的 SPA 兜底里按路径注入：

| 注入内容 | 位置 |
|---|---|
| `<title>`、description、keywords、robots | `service/seo/render.go` |
| `<link rel="canonical">` | 同上 |
| OG / Twitter 卡片（分享到微信/X/Telegram 才好看） | 同上 |
| JSON-LD：Organization / WebSite / WebPage（首页额外 WebApplication） | 同上 |
| 站长验证 meta（Google / 百度 / Bing） | 后端配置 |

改哪个页面就改哪条，不用重新构建：配置存 Option `SeoConfig`，保存后立即失效缓存。

### 2. 三个入口文件

| 路径 | 作用 | 谁在看 |
|---|---|---|
| `/robots.txt` | 放行普通抓取、屏蔽后台；**显式点名放行 12 个 AI 爬虫** | 所有爬虫 |
| `/sitemap.xml` | 列出可索引页面（noindex 自动排除） | Google/Bing/百度 |
| `/llms.txt` | 给大模型看的站点说明书（是什么、有哪些页、怎么引用） | ChatGPT/Perplexity 等 |

> `AllowAICrawlers` 关掉后，robots.txt 会反过来 Disallow 这些 UA —— 等于从 AI 搜索里消失。默认开着。

### 3. 前端同步

`SeoRouteSync`（挂在根组件）在 SPA 内部跳转时重写 head，
和服务端注入共用同一份后端配置，不会出现「首页 title 对、点进画廊又变回站名」的割裂。

### 4. 后台界面

**系统设置 → Fork settings → SEO 管理**：站点信息、页面级覆盖、OG 图、站长验证、
llms.txt 自定义、robots/sitemap/llms 一键预览，底部有 Google 搜索结果实时预览。

### 5. 提示词详情页改成真路由（长尾流量的入口）

之前详情是弹窗（`/prompt-gallery?prompt=123`），对爬虫等于不存在：没有独立 URL、
没有独立标题、分享出去只是一张列表页。现在：

| 改动 | 位置 |
|---|---|
| 新路由 `/prompt-gallery/:id` | `web/src/routes/prompt-gallery/$id.tsx` + `features/prompt-gallery/detail-page.tsx` |
| 服务端按 id 查库注入该条的标题/描述/封面/JSON-LD | `service/seo/detail.go` |
| 记录不存在返回 **404 + noindex** | 同上（`DetailMeta.NotFound`） |
| sitemap 逐条收录已发布提示词 | `service/seo/render.go#detailEntries` |
| 卡片标题变真 `<a href>`、推荐位也是真链接 | `components/gallery-card.tsx`、`recommend-strip.tsx` |
| 旧分享链接 `?prompt=123` 自动跳到新地址 | `features/prompt-gallery/index.tsx` |

单条页额外注入的内容：

- `<title>` = 作品名 + 「AI 绘画提示词 / AI 视频提示词」+ 站名
- description = **提示词正文前 110 字** + 一句「在哪用、能干什么」——这是最贴合搜索原话的描述
- `og:type=article` + `article:published_time` / `article:modified_time`
- JSON-LD 增加 `ImageObject` / `VideoObject`（name/author/datePublished/keywords/genre）+ `BreadcrumbList`
- 一段 `<noscript>` 正文（标题 + 作者 + 模型 + 提示词 + 标签 + 回画廊链接）——
  不执行 JS 的 AI 爬虫靠它读到真实内容。这是可见内容，不是隐藏文本，不构成 cloaking。

实测（本地）：

```
/prompt-gallery/28      → 200 · 兔面具的电影海报 · AI 视频提示词 · 一幕AI · index,follow
/prompt-gallery/999999  → 404 · 提示词不存在 · 一幕AI · noindex,follow
/sitemap.xml            → 18 条（8 个静态页 + 10 条已发布提示词）
```

> 之前 `cover` 存的是 `data:image/svg+xml` 占位图，`og:image` 会拼出
> `https://cdymm.com/data:image/...` 这种坏地址。已处理：data URI 直接跳过，
> 退回站点默认 OG 图。真实图片进库后自然生效。

---

## 二、上线后必做的 5 件事（不做前面白干）

1. **确认站点地址正确**
   后台「SEO 管理 → 全站默认」里 `baseUrl` 必须是线上真实域名（默认 `https://cdymm.com`），
   canonical 与 sitemap 全靠它。

2. **提交站点地图**
   - Google Search Console → 添加资源 → 验证（把验证码填进后台）→ 提交 `https://cdymm.com/sitemap.xml`
   - Bing Webmaster Tools → 同上（可一键从 GSC 导入）
   - 百度搜索资源平台 → 验证 + 提交 sitemap

3. **手工验证注入是否生效**
   ```bash
   curl -s https://cdymm.com/prompt-gallery | grep -E "<title>|description|canonical|ld\+json"
   curl -s https://cdymm.com/robots.txt | head -20
   curl -s https://cdymm.com/llms.txt | head -20
   ```
   注意：**curl 拿到的必须是带标题的 HTML**。如果只有空 `#root`，说明注入没走到（检查是否被 Nginx/1Panel 缓存成静态文件）。

4. **让详情页的封面是真实图片地址**
   详情页已改成真路由，但早期种子数据的 `cover` 是 `data:image/svg+xml` 占位图，
   `og:image` 会退回站点 logo。把作品封面换成真实地址（`/storage/...` 或 `https://...`），
   分享到微信/X 才有图。

5. **内容要有「可引用段落」**
   AI 搜索喜欢能直接摘的短段落。每个分类页/详情页建议有 2–3 句「是什么 + 适合谁 + 怎么用」的定论式描述，
   而不是一堆关键词堆砌。详情页的 description 现在直接取提示词正文，天然满足这一点。

---

## 三、GEO 专门做法（区别于传统 SEO）

| 做法 | 为什么有效 | 本项目是否已支持 |
|---|---|---|
| 放行 AI 爬虫 | 不放行 = 不存在 | ✅ robots.txt 已显式放行 |
| 服务端可读的正文 | 爬虫不跑 JS | ✅ 提示词详情页有 `<noscript>` 正文（标题/作者/模型/提示词/标签）；⚠️ 首页与画廊列表正文仍靠 JS 渲染，只有标题描述是服务端注入的 |
| `llms.txt` | 给模型的目录页 | ✅ 自动生成 + 可自定义 |
| 结构化数据 | 模型理解实体关系 | ✅ Organization / WebSite / WebPage / WebApplication，详情页另加 ImageObject/VideoObject + BreadcrumbList |
| 品牌名一致 | 「一幕AI」「YMM」「cdymm.com」要绑成一个实体 | ✅ 站名 + alternateName 已写入 JSON-LD |
| 外部提及 | AI 更信「别处也这么说」 | ❌ 需要你去做：知乎/B站/GitHub/小红书发同名内容，链接回站 |
| 明确作者与更新时间 | 提升可信度 | ⚠️ 可在 llms.txt / 页面里补 |

**下一步最划算的 GEO 动作**（按 ROI 排序）：
1. 详情页真路由 + 服务端注入（让每一条提示词都能被单独引用）
2. 分类页加定论式摘要段
3. 站外 3–5 个高质量提及（比在站内堆关键词有效得多）

---

## 四、首页性能：查了什么、改了什么

### 结论先讲：懒加载**已经在用**，短板不在图片

核查结果：

| 项 | 现状 | 处理 |
|---|---|---|
| 画廊卡片图 | 已有 `loading="lazy" decoding="async"` | 无需改 |
| 首页模型图 / 落幕图 / 装饰图 | 已有 lazy | 无需改 |
| 路由级分包 | TanStack Router 自动分包（产物里有 20+ async chunk） | 已具备 |
| vendor 分包 | `vendor-react` / `vendor-ui-primitives` / `vendor-tanstack` 已拆 | 已具备 |
| **首屏背景视频 `preload="auto"`** | 首屏就和 JS/CSS 抢带宽下 600KB+ 视频 | ✅ 改 `metadata` + 加 poster 静帧 |
| **7 个语言包全量静态 import** | 约 4.5MB 源码进主 chunk（gzip ≈ +1MB） | ✅ 改按需 `import()`，只内联英文兜底 |
| **构建产物缓存头只有 1 周** | 带 hash 的文件每次回访仍要校验 | ✅ 改 `max-age=31536000, immutable` |

### 首屏为什么会先闪「NEWAPI」——根因

三处叠加，不是单一 bug：

1. `web/index.html` 里写死 `<title>New API</title>` —— HTML 一到达浏览器标签页就显示它，此时 JS 还没下载完；
2. `main.tsx` 的 `initSystemBranding()` 拿到 `system_name` 后又把标题改一次，而**数据库里的 `SystemName` 仍是历史默认值 `New API`**（改了代码默认值不改已存库的值）；
3. Header 的品牌组件 `status?.system_name || 'New API'` 兜底也是它。

已修：静态 title 改「一幕AI」、代码默认站名改「一幕AI」、服务端按路径注入标题、`main.tsx` 检测到注入标记就不再覆盖。

> ⚠️ **必须你手动做一步**：后台「系统设置 → 站点 → 系统名称」里把 `New API` 改成 `一幕AI`。
> 老数据在数据库里，改代码不会自动迁移。

### 实测前后对比（`web/dist/static/js`）

优化后主包已从 5.2MB 降到下面这个量级：

| 文件 | 源码 | gzip |
|---|---|---|
| `index.*.js`（主包） | 1596 KB | **394 KB** |
| `8930.*.js` | 720 KB | 203 KB |
| `vendor-ui-primitives.*.js` | 336 KB | 108 KB |
| 中文语言包 `3161.*.js`（按需） | 516 KB | 独立 async chunk，不进首屏 |

### 还剩的最大一块

主包仍有 ~1.6MB 源码（gzip 394KB），主要是**应用代码本身**（所有 feature 的常量、图表、控制台页面）。
再往下优化需要按页面做更细的懒加载（例如把控制台、渠道管理、模型定价这些重页面彻底拆出去），
属于「改一次影响面大」的手术，建议先上线观察真实数据再决定。

---

## 五、验收清单

- [ ] `curl https://cdymm.com/ | grep "<title>"` → 出现「AI 绘画、视频生成与提示词画廊 · 一幕AI」
- [ ] `curl https://cdymm.com/prompt-gallery | grep title` → 出现画廊专属标题
- [ ] `curl -o /dev/null -w "%{http_code}" https://cdymm.com/prompt-gallery/1` → `200`，`grep title` 出该条的标题
- [ ] `curl -o /dev/null -w "%{http_code}" https://cdymm.com/prompt-gallery/999999` → `404`
- [ ] 详情页 HTML 里能 `grep noscript` 到提示词正文
- [ ] `curl https://cdymm.com/console | grep robots` → `noindex,follow`
- [ ] `/robots.txt` 能看到 `User-agent: GPTBot` 段
- [ ] `/sitemap.xml` 条数 = 静态页数 + 已发布提示词数，且 `<loc>` 域名正确
- [ ] `/llms.txt` 有站名、简介、页面列表
- [ ] 后台「SEO 管理」能读能存，预览区实时变化
- [ ] 列表页点卡片进详情、浏览器返回能回到原来的滚动位置
- [ ] 旧链接 `/prompt-gallery?prompt=1` 会自动跳到 `/prompt-gallery/1`
- [ ] 标签页不再先闪「NEWAPI」
- [ ] 首屏视频不再首屏抢带宽（DevTools Network 里视频请求出现在 JS 之后）
- [ ] 语言切到英文/日文时能正常加载（语言包按需拉取）
