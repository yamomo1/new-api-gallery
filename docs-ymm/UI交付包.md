# YMM · UI 交付包 v2.1

> 这是一份**自包含**的交付物：把它整份（尤其是 §2 的提示词）复制给你的代码智能体，
> 它不需要知道我们之前的任何对话，就能按这套 UI 改造现有站点。
> 生成时间：2026-11-01 · 依据真源：`design-system/tokens.css`、`home-v2.html`、`detail-v2.html`

## 阅读路径指引（给智能体）

按这个顺序读，不要跳步：

1. **§1 设计说明** —— 唯一数值依据。所有色值/字号/间距/断点都已核实，**不要自己估算像素**。
2. **§2 提示词** —— 整段复制执行，它已含任务目标、路径、边界、自检项。
3. **§3 文件清单** —— 哪些文件已存在可直接引用、哪些资源需替换。
4. **§4 验收标准** —— 改完逐项打勾。

真源文件位置（相对本仓库根目录）：

| 用途 | 路径 |
|---|---|
| 设计令牌唯一真源（所有数值以它为准） | `design-system/tokens.css` |
| 首页目标版式 + 全部配套 JS | `design-system/home-v2.html` |
| 详情页目标版式 | `design-system/detail-v2.html` |
| 已完成的接入层说明（含两个已踩的坑） | `docs/设计系统接入方案.md` |
| 设计决策依据（借鉴了什么、放弃了什么） | `docs/liblib深度拆解与YMM设计方向.md` |

---

## 0. 用法

1. 把 **§2 的提示词**整段复制给代码智能体（它已包含目标、路径、边界、自检项）。
2. 把 **§1 设计说明**作为它的「唯一数值依据」一并给出——里面所有色值/间距/断点都取自真源，
   不要让智能体自己「估算」像素值。
3. 用 **§4 验收标准**逐项打勾验收。

---

## 1. 设计说明

### 1.1 一句话主张

**从「工具型货架」转向「策展型画报」。**
参考站（liblib.art）把能力摆成货架，我们把灵感摆成画报；货架让人选得完，画报让人想动手。

落到视觉上就是五条可被检验的原则：

| 原则 | 具体判据 |
|---|---|
| **少一半** | 首屏可交互元素 ≤ 12 个；不做促销条、不做登录浮层、不做会员弹窗 |
| **大一倍** | 区块间距 ≥ 96px；列表项间距 ≥ 24px；卡片内边距 ≥ 20px；正文行高 ≥ 1.75 |
| **一个动作** | 全站唯一主动作是「生成同款 / 开画」，任何卡片 hover 必现；其余操作降级为图标行 |
| **无框分层** | 卡片默认 `border: none`，靠留白与 `--card`/`--card-2` 色阶分层；不叠加多重描边 |
| **克制的炫** | 动效只出现在首屏 / 指针 / 列表三处；一屏内高饱和色 ≤ 2 处 |

> 用户明确要求的 UI 铁律（必须遵守）：**大气、宽松、少条条框框**。
> 禁止出现「12px 小字 + 8px 间距 + 密集细边框」这类信息密度型组合。

### 1.2 页面结构与层级（类名清单，取自真源）

**首页** `design-system/home-v2.html`

```
header.nav#nav
  a.brand > span.logo + em
  nav.nav-links > a(.on 表示当前)
  div.nav-right > button.icon-btn#themeBtn + a.btn.btn-quiet + a.btn.btn-primary
main#top
  section.hero#hero                      [首屏]
    div.aurora                           ← 极光漂移背景
    div.wrap > span.eyebrow + i
    h1 > span.grad                       ← 第二词渐变字
    p
    div.hero-actions > a.btn.btn-primary.btn-lg + a.btn.btn-ghost.btn-lg
    form.searchbar.ymm-glass > button.btn.btn-primary
    div.stats > div.stat > b.ymm-count + span   （数字滚动）
  div.strip > div.strip-track#stripTrack         ← 胶片跑马灯，两侧羽化
  section.sec.wrap#spotlight             [精选策展]
    div.sec-head.ymm-reveal > span.eyebrow + h2.sec-title + p.sec-sub + a.btn.btn-quiet
    div.sp-grid > article.sp.ymm-reveal.ymm-spotlight
      div.sp-cover > div.scrim
      div.sp-tags > span.sp-tag
      div.sp-foot > h3 + p
      div.sp-meta > span.who > span.av ; span.pill
  section.sec.wrap#flow                  [三步闭环] 只有巨大渐变序号，无卡片框
  section.sec.wrap#inspire               [灵感流] chip 过滤 + div.wf > div.wf-col > article.pcard
  section.sec.wrap#motion                [动效 Motion] div.mgrid > 9 个 tile
  section.sec.wrap#kit                   [组件 Components] div.kgrid > 8 张卡
  section.wrap#cta / footer
aside.navfab#navFab                      ← 右下「章节直达」悬浮目录
div.accent-bar                           ← 左下「配色」面板
div.ymm-cursor-glow#glow                 ← 全局跟随光晕
```

**详情页** `design-system/detail-v2.html`

```
section.detail.wrap#stage                [这一幕]
  div.stage
    div.stage-img.shot#stageImg > div.layer.on.shot ×4   ← 交叉淡入切幕
    div.grain / div.stage-tags > span / div.stage-mark
    div.stage-tools.ymm-glass-menu > button#zoomBtn #compareBtn #fullBtn
    div.stage-meta > span#stageNo
  div.thumbs#thumbs > button.shot(.on) ×4
aside.panel                              ← 决策区，左侧 sticky 大图 + 右侧滚动
  span.eyebrow / h1 > span.grad
  div.author-row > div.avatar + div.who > b + button.btn.btn-quiet#followBtn
  p.desc
  div.actions > button.btn.btn-primary.btn-xl.ymm-btn-glow#makeBtn  ← 唯一主动作
                div.icon-row > button.icon-btn#favBtn #shareBtn #moreBtnIco
  div.metrics > span.m > b
  div.tabs（提示词 / 参数 / 版本）三选一  ← 不做参数墙
```

### 1.3 配色

**中性基底（黑/白两套）**

| 令牌 | 浅色 | 深色 | 用途 |
|---|---|---|---|
| `--background` | `#ffffff` | `#09090b` | 页面底色 |
| `--foreground` | `#18181b` | `#fafafa` | 主文字 |
| `--card` | `#ffffff` | `#131316` | 卡片表面 |
| `--card-2` | `#f4f4f5` | `#1c1c20` | 次级表面（输入框底/分组底） |
| `--card-3` | `#ececef` | `#26262b` | 凸起/悬停 |
| `--muted` | `#71717a` | `#a1a1aa` | 次要文字 |
| `--subtle` | `#a1a1aa` | `#71717a` | 极弱文字/占位 |
| `--border` | `#e4e4e7` | `#27272a` | 发丝线 |
| `--border-strong` | `#d4d4d8` | `#3f3f46` | 强描边/聚焦 |

**强调色（ `--primary` 系列，随预设整体切换）**

| 令牌 | 浅色 | 深色 |
|---|---|---|
| `--primary` | `#5b5bd6` | `#8b8bf5` |
| `--primary-hover` | `#4f4fcb` | `#9d9df7` |
| `--primary-fg` | `#ffffff` | `#0b0b0f` |
| `--primary-soft` | `rgba(91,91,214,.10)` | `rgba(139,139,245,.14)` |
| `--primary-ring` | `rgba(91,91,214,.35)` | `rgba(139,139,245,.45)` |
| `--primary-grad` | `linear-gradient(135deg,#8284e8,#5252cf)` | `linear-gradient(135deg,#a3a3f8,#7e7ee8)` |

> **对比度铁律**：中高亮度的预设（青/橙/绿/黄/冰川蓝）必须把 `--primary-fg` 换成深色字
> （如 `#042f3a` / `#2a1300` / `#04221a`），否则白字压上去只有约 2.5:1，不达标。

**12 套预设（`html.accent-*`，浅色值 / 深色值）**

| class | 名称 | 浅色 | 深色 | 渐变 `--primary-grad` |
|---|---|---|---|---|
| `accent-indigo` | 墨靛蓝（默认） | `#5b5bd6` | `#8b8bf5` | `#8284e8→#5252cf` |
| `accent-violet` | 紫电 | `#7c5cff` | `#a78bfa` | `#9b84ff→#6d49f5` |
| `accent-cyan` | 电光青 | `#06b6d4` | `#22d3ee` | `#4cc9e8→#0891b2` |
| `accent-orange` | 暖橙 | `#f97316` | `#fb923c` | `#fb9a4d→#e86a0e` |
| `accent-rose` | 玫瑰 | `#ec4899` | `#f472b6` | `#f272b0→#db2777` |
| `accent-emerald` | 墨绿 | `#10b981` | `#34d399` | `#3fc79a→#0b9a6d` |
| `accent-sakura` | 樱花粉 | `#e0679f` | `#f19cc5` | `#f9b8d9→#ec7fb4` |
| `accent-peach` | 蜜桃 | `#ec7a5c` | `#f5a184` | `#fcd9bd→#f5a98a` |
| `accent-butter` | 奶油黄 | `#dba615` | `#f4c95d` | `#fbe8a6→#f2ce5f` |
| `accent-ice` | 冰川蓝 | `#2fa8e0` | `#6cc9f2` | `#bae6fd→#6cc0ea` |
| `accent-lime` | 青柠 | `#82b91c` | `#a3e635` | `#d9f99d→#a3e635` |
| `accent-lilac` | 丁香紫 | `#8f7bf2` | `#b7a7f8` | `#ddd1fb→#b3a1f5` |

> 深色规则用 `html.dark.accent-*`（特异性 0,2,1）覆盖，两套值不会互串。

**语义色**：`--success #16a34a/#22c55e`、`--warning #d97706/#f59e0b`、
`--danger #dc2626/#f87171`、`--info #2563eb/#60a5fa`（浅/深）。

> **任何视觉元素不得硬编码强调色**，一律由 `--primary` 用 `color-mix()` 派生。
> 已踩过坑：全局光晕曾写死 `rgba(139,139,245,.20)`，导致换肤时光晕永远不变色。

### 1.4 字体

```css
--font-sans: "Public Sans Variable", "Public Sans", system-ui, "Noto Sans SC", "Source Han Sans SC", sans-serif;
--font-serif: "Lora", Georgia, serif;   /* 展示标题 */
--font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Courier New", monospace;
```

- 全部 SIL OFL，**可免费商用**；已剔除 `Microsoft YaHei` / `PingFang SC` / `Segoe UI` 等专有字体。
- 站点已自托管 `PublicSans-var.woff2` / `Lora-var.woff2`（`src/styles/fonts/`）。
- **零外网依赖铁律**：不得引入 `fonts.googleapis.com` 等阻塞渲染的外网资源
  （曾导致整站白屏：`<link rel="stylesheet">` 是阻塞渲染的，国内不可达会白到超时）。

### 1.5 字号阶梯

| 令牌 | 值 | 用途 |
|---|---|---|
| `--text-xs` | 12px | 角标/辅助说明（少用） |
| `--text-sm` | 13px | 次要信息 |
| `--text-base` | 14px | **正文下限，不得更小** |
| `--text-md` | 15px | 卡片标题 |
| `--text-lg` | 18px | 区块小标题 |
| `--text-xl` | 22px | 区块标题 |
| `--text-2xl` | 28px | **页面主标题下限** |
| `--text-3xl` | 36px | Hero 副标题 |
| `--text-4xl` | 48px | Hero 主标题 |

正文行高 **≥ 1.75**。

### 1.6 间距（4px 基数）

`--space-1:4 · --space-2:8 · --space-3:12 · --space-4:16 · --space-5:20 · --space-6:24 · --space-8:32 · --space-10:40 · --space-12:48 · --space-16:64`

**强制下限**：区块之间 ≥ 32px；列表项之间 ≥ 24px；卡片内边距 ≥ 20px。

### 1.7 圆角（方形圆角，不要胶囊）

`--radius-sm:6 · --radius:10 · --radius-lg:14 · --radius-xl:20 · --radius-full:999`

标签、按钮、卡片一律用**方形圆角**（`--radius` ~ `--radius-sm`），**不要**胶囊形（除非头像/徽章）。

### 1.8 阴影

```css
--shadow-sm: 0 1px 2px rgba(24,24,27,.05);
--shadow:    0 1px 2px rgba(24,24,27,.04), 0 10px 28px -14px rgba(24,24,27,.16);
--shadow-lg: 0 24px 60px -28px rgba(24,24,27,.28);
```
深色下用更强的黑：`0 1px 2px rgba(0,0,0,.45), 0 12px 32px -14px rgba(0,0,0,.7)` 等。

### 1.9 动效

```css
--ease: cubic-bezier(0.16, 1, 0.3, 1);   /* 主缓动（快出慢入） */
--ease-out: cubic-bezier(0.22, 1, 0.36, 1);
--dur-fast: 150ms;  --dur: 200ms;  --dur-slow: 500ms;
```

关键帧（全部已在 `tokens.css` 定义，**直接复用，不要重写第二套**）：
`ymm-fade-up` `ymm-pop` `ymm-pop-in` `ymm-shine` `ymm-drift`（极光） `ymm-pulse` `ymm-shimmer` `ymm-spin` `trackFlow`（滑块流光带）

必须实现 `@media (prefers-reduced-motion: reduce)` 降级。

### 1.10 组件类名规范（`.ymm-*`，与现有 CSS 零冲突）

| class | 作用 | 配套 JS |
|---|---|---|
| `ymm-reveal` | 滚动进入视口上浮淡入，`data-d="1..4"` 错峰 | IntersectionObserver |
| `ymm-btn-glow` | 按钮流光 + 辉光 hover | 纯 CSS |
| `ymm-card-rise` | 卡片抬升 + 顶部强调线 | 纯 CSS |
| `ymm-shimmer-text` | 标题流光扫过 | 纯 CSS |
| `ymm-shimmer-bg` | 骨架屏微光 | 纯 CSS |
| `ymm-spotlight` | 卡片指针聚光 | 写入 `--mx/--my` |
| `ymm-cursor-glow` | 全局跟随光晕（190px，`blur(4px)`） | rAF 写 transform |
| `ymm-glass` / `ymm-glass-menu` | 磨砂玻璃面板 / 菜单 | 纯 CSS |
| `ymm-dd` `.ymm-dd-menu` `.ymm-dd-item` | 自定义下拉（向下弹出 + 缩放淡入） | 开合/Esc/外点 |
| `ymm-slider` | 方角凹槽滑块 + 常驻流光 + **滚轮微调** | `--fill` + wheel |
| `ymm-wf-card` `ymm-wf-collapse` | 瀑布流卡片 + 悬停推挤展开 | `grid-template-rows:0fr→1fr` |
| `ymm-wbtn` | 渐变按钮 | 纯 CSS |

光晕的 `mix-blend-mode`：浅色 `multiply`、深色 `screen`。

### 1.11 响应式断点

| 断点 | 表现 |
|---|---|
| **瀑布流列数** | `<540px`→1 列；`<780px`→2；`<1080px`→3；否则 4 列 |
| `max-width:900px` | 精选策展 `sp-grid`、三步闭环 `steps`、组件区 `kgrid` 转单列；导航第 4 项起隐藏 |
| `max-width:1040px` / `660px` | 动效区 `mgrid` 2 列 → 1 列 |
| `max-width:980px`（详情页） | 主区由「左 sticky 大图 + 右决策区」退化为单列堆叠；`aspect-ratio` 由 4/5 放宽到 4/3 |
| `max-width:720px` | 隐藏左下配色面板与右下目录浮标 |
| `(hover:none)` | 触屏设备上折叠面板常驻展开（`grid-template-rows:1fr`），不依赖 hover |

---

## 2. 可直接粘贴的提示词

> **复制下面整段给你的代码智能体。** 它不依赖任何外部对话上下文。

````text
# 任务：按指定 UI 规范改造现有前端站点（增量修改）

## 0. 背景与目标
本项目是 YMM（一幕AI）画廊站的前端。我已经完成了一套 UI 设计系统，现在需要你按这套设计，
改造现有网页的视觉与交互。核心主张是「策展型画报」：大气、宽松、少条条框框、适合年轻人潮流，
而不是工具后台那种高密度货架。

## 1. 项目位置与技术栈（必须保留，不得更换）
- 前端目录：gallery-frontend/
- 设计系统真源：design-system/tokens.css、design-system/home-v2.html、design-system/detail-v2.html
- 技术栈（禁止替换或升级）：rsbuild 1.x + React 18 + TypeScript + react-router-dom 6
  + @tanstack/react-query 5 + antd v6 + @radix-ui（dialog/dropdown-menu/tabs/tooltip）
  + lucide-react 图标
- 必须保留的现有功能：所有路由页面、所有 /api 与 /v1 接口调用、登录注册、后台管理
  （src-admin/）、i18n、SEO 注入、站点内容后台配置（site.json / lib/content.tsx）
- 深浅色主题由 <html> 上的 class 控制：dark / light

## 2. 改动边界（严格遵守）
只做下面这些，**不做任何无关重构**：
- 允许改：src/styles/global.css（增量追加或定向替换样式规则）
- 允许改：src/components/*.tsx 与 src/pages/*.tsx 的 className 与 DOM 结构
- 允许新增：src/components/ymm/ 下的封装组件
- **禁止**：更换依赖版本、重写路由、重写 API 层、改 Dockerfile/compose、
  重命名现有 CSS 变量、删除现有业务功能、改写 src-admin/
- **禁止**：引入任何外网资源（尤其是 fonts.googleapis.com）——这类 <link rel="stylesheet">
  是阻塞渲染资源，国内不可达会导致整站白屏。字体已自托管。

## 3. 参考真源（先读这几个文件，全部数值以它们为准，不要自己估算像素）
- design-system/tokens.css        全部设计令牌（色值/字号/间距/圆角/阴影/动效/12 套预设）
- design-system/home-v2.html      首页目标版式（Hero / 精选 / 三步 / 灵感流 / 动效 / 组件）
- design-system/detail-v2.html    详情页目标版式（sticky 大图 + 右侧决策区 + Tab 配方）
- design-system/设计规范.md       完整规范
- docs/设计系统接入方案.md        已完成的接入层说明（含两个必知的坑）

## 4. 实现要求

### 4.1 令牌（已接入，直接引用，不要再复制一份）
src/styles/ymm-tokens.css 已由脚本从 design-system/tokens.css 生成，main.tsx 已引入。
它是由 ../design-system/tokens.css 单向生成的，**不要手工编辑**；
改令牌请改真源后运行 npm run sync:design（npm run dev / build 会自动跑）。
新增令牌优先加在 tokens.css，**令牌只维护一份**，不得在页面里再写第二套。

### 4.2 视觉规范（照抄，不得自由发挥）
- **留白铁律**：区块之间 ≥32px；列表项之间 ≥24px；卡片内边距 ≥20px；正文行高 ≥1.75。
  严禁「12px 小字 + 8px 间距 + 密集细边框」这类信息密度型组合。宁可少放内容也不要挤。
- **无框分层**：卡片默认 border:none，用留白与 --card / --card-2 色阶做层次，
  不要层层描边、不要小卡片套小卡片、不要用分割线切每一块。
- **方形圆角**：标签/按钮/卡片一律用 var(--radius) ~ var(--radius-sm)，不要用胶囊形。
- **字号下限**：正文 ≥14px（var(--text-base)）；区块标题 ≥18px；页面主标题 ≥28px。
- **字号/间距/颜色一律走 CSS 变量**，不得写死十六进制在组件样式里。

### 4.3 配色与换肤
- 12 套预设通过给 <html> 加 accent-* class 切换（如 html.accent-sakura），
  深浅两套值由 CSS 自身处理，不要写 JS 去算颜色。
- 组件必须引用 --primary / --primary-grad / --primary-fg / --card-2 等变量，
  确保换肤零改组件。
- **任何元素不得硬编码强调色**，需要派生色请用 color-mix(in srgb, var(--primary) N%, transparent)。
- 注意两个已踩过的坑（代码里已处理，你改时务必保持）：
  1) inline style 优先级高于 CSS class：一旦往 <html style> 写过 --primary，
     accent-* class 就失效。两种模式切换时必须清理对方。
  2) MutationObserver 监听 <html> class 时，若在回调里又改 class 会自触发死循环，
     必须保留幂等短路。
- global.css 里被实际引用的是另一批别名（--accent / --gold / --lime / --lime-bright /
  --gold-soft）。ymm-tokens.css 里有一段 html[class*="accent-"] 桥接层把它们映射到
  --primary 系列，**改动时不要破坏这段桥接**，否则会出现「选了樱花粉、按钮还是金色」。

### 4.4 组件与动效（复用现成类，不要重写）
- 直接用 .ymm-* 类：ymm-reveal（滚动揭示）、ymm-btn-glow（按钮流光）、
  ymm-card-rise（卡片抬升）、ymm-spotlight（指针聚光）、ymm-cursor-glow（全局光晕）、
  ymm-glass / ymm-glass-menu（磨砂）、ymm-dd（下拉）、ymm-slider（滑块+滚轮微调）、
  ymm-wf-card / ymm-wf-collapse（瀑布流推挤展开）、ymm-wbtn（渐变按钮）。
- 配套 JS 从 design-system/home-v2.html 的 <script> 里搬；建议封装到
  src/components/ymm/ 下，不要每个页面各抄一遍。
- 必须保留 @media (prefers-reduced-motion: reduce) 降级。

### 4.5 布局与响应式
- 瀑布流：卡片 data-ar 属性记录长宽比（宽/高），JS 初始化时下发给 CSS 变量 --ar；
  列数规则 <540px→1、<780px→2、<1080px→3、否则 4。注意相对高度是 1/ar，别写反。
- 详情页窄屏 ≤980px 退化为单列堆叠；触屏 (hover:none) 下折叠面板常驻展开。

### 4.6 建议的推进顺序（先小后大，便于回滚）
1. 先改造 GalleryHome.tsx 的一个区块做试点，跑起来对比效果
2. 再改 Nav / Hero / 卡片，落实「去边框 + 大留白」
3. 最后做详情页

## 5. 完成自检（逐项确认并在回复里报告结果）
1. `npx tsc --noEmit -p tsconfig.json` 无报错
2. `npm run build` 构建通过
3. 页面可正常打开，首屏有可见内容（不得出现白屏或 #root 为空）
4. 无外网阻塞资源：检查 index.html 与产物里不含 fonts.googleapis.com 等
5. 12 套配色点击均能整站生效，且 --gold/--lime/--accent 等别名同步跟随（桥接未被破坏）
6. 深浅主题切换正常，且 localStorage 记住选择
7. 浏览器 console 零报错
8. 响应式：1440 / 1000 / 760 / 480 四个宽度下布局不破版
9. 未触碰 §2 中列出的禁止项（依赖、路由、API、后台、Dockerfile）

## 6. 交付方式
增量修改现有文件，不要重写整个项目、不要新建替代目录把旧代码架空。
每处改动请说明「改了哪个文件、为什么这么改」，并在最后给出 §5 的自检结果清单。
````

---

## 3. 文件清单

### 3.1 已存在、需引用/修改的文件

| 路径 | 作用 | 内容要点 |
|---|---|---|
| `design-system/tokens.css` | **设计令牌唯一真源** | 中性基底明暗双套、`--primary` 强调色系列、12 套 accent 预设（含 `--primary-grad`）、9 个关键帧、26 个 `.ymm-*` 组件类 |
| `design-system/home-v2.html` | **首页目标版式原型** | 直接 `<link>` 引 tokens.css；Hero/精选/三步/灵感流/动效/组件六段；含全部配套 JS；右下悬浮目录 |
| `design-system/detail-v2.html` | **详情页目标版式原型** | sticky 大图舞台 + 右侧决策区 + 配方 Tab + 灯箱 + 幕切换交叉淡入 |
| `design-system/设计规范.md` | 完整规范文档 | §11 首页骨架、§12 详情页、§13 铁律（零外网依赖 / 白屏排查口诀） |
| `design-system/preview.html` | 早期组件沙盒（历史参考） | ⚠️ 其 `<style>` 内联了一份**过时的令牌副本**，只看结构，取值以 tokens.css 为准 |
| `docs/liblib深度拆解与YMM设计方向.md` | 设计决策依据 | 12 条可借鉴 + 6 条不借鉴、P0/P1/P2 路线、首页/详情页版式蓝图 |
| `docs/设计系统接入方案.md` | 接入层说明 | 变量冲突表、同步脚本设计、桥接层原理、两个已踩的坑 |
| `gallery-frontend/src/styles/ymm-tokens.css` | 站点令牌层（**生成物**） | 由脚本单向生成，勿手改；含桥接层与 `.ymm-look` 开关 |
| `gallery-frontend/scripts/sync-design-system.mjs` | 同步生成器 | `--check` 模式供 CI 卡不同步 |
| `gallery-frontend/src/main.tsx` | 入口 | 已 `import './styles/ymm-tokens.css'` |
| `gallery-frontend/src/components/ThemeApplier.tsx` | 换肤核心 | 12 套预设、两种模式互斥、幂等短路 |
| `gallery-frontend/src/components/Nav.tsx` | 导航 + 调色盘 | 12 套色块（渐变显示）+ 当前色名 |
| `gallery-frontend/src/styles/global.css` | 站点主样式 | 改造的主要战场（增量修改） |
| `gallery-frontend/src/pages/GalleryHome.tsx` | 首页 | 建议首个试点 |

### 3.2 需要新增/替换的资源

| 资源 | 现状 | 需要做什么 |
|---|---|---|
| **封面图 / 作品图** | 原型用 CSS 渐变占位（`.shot`，由 `--c1/--c2/--c3` 驱动） | 替换为真实 `<img>`；`.layer` 结构不要动，保持交叉淡入能工作；建议给 `aspect-ratio` 与 `object-fit: cover`，避免布局跳动 |
| **图标** | 已用 `lucide-react`（v0.453），原型里是内联 SVG（stroke 1.8、24 viewBox） | 统一改为 lucide 组件（`ZoomIn / Columns / Maximize2 / Heart / Share2 / Dices / Copy` 等），保持 stroke-width 视觉一致 |
| **作者头像** | 原型用 CSS 渐变圆 | 替换为真实头像图，圆形 + `--radius-full` |
| **favicon / logo** | `public/favicon.ico`、`public/logo.png` 已存在 | 沿用 |
| **字体** | `src/styles/fonts/PublicSans-var.woff2`、`Lora-var.woff2`（SIL OFL，自托管） | 沿用；**不要**再加 Google Fonts |
| **品牌运营位**（可选） | 无 | 若要在 Hero 加插画，尺寸建议 1600×900 以上，`background-size: cover` |

---

## 4. 验收标准（逐项打勾）

**构建与运行**
- [ ] `npx tsc --noEmit -p tsconfig.json` 零报错
- [ ] `npm run build` 通过，`dist/static/css/*.css` 中含 24 条 `accent-*` 规则
- [ ] 页面正常打开，`#root` 有子节点，**无白屏**
- [ ] 浏览器 console **零报错**
- [ ] 产物与 `index.html` 中**不含** `fonts.googleapis.com` 等阻塞渲染的外网资源

**设计还原**
- [ ] 区块之间实测间距 ≥ 32px；列表项 ≥ 24px；卡片内边距 ≥ 20px
- [ ] 正文行高 ≥ 1.75，正文字号 ≥ 14px，页面主标题 ≥ 28px
- [ ] 卡片默认 `border: none`，层次靠留白与 `--card-2` 色阶表现，**不是**靠描边
- [ ] 标签/按钮/卡片为方形圆角（非胶囊）
- [ ] 全站只有唯一主动作是「生成同款/开画」，其余操作降级为图标行
- [ ] 一屏内高饱和色 ≤ 2 处

**令牌与换肤**
- [ ] 12 套配色逐个点击，全站主色/强调/渐变/光晕同步变化
- [ ] 切到樱花粉后 `--gold`、`--lime`、`--accent` 也跟着变（**桥接层未被破坏**）
- [ ] 深浅主题切换正常，`localStorage` 记住选择，刷新后保持
- [ ] 代码里**没有**硬编码的强调色（grep `rgba(139,139,245` 与 `#5b5bd6` 应只在 presets 定义处出现）

**组件与动效**
- [ ] 滚动揭示、按钮流光、卡片抬升、指针聚光、全局光晕均生效
- [ ] 自定义下拉向下弹出且有动效，Esc / 点击外部能关闭，**不被其它元素遮挡**
- [ ] 滑块方角凹槽 + 常驻流光 + 鼠标滚轮可微调，读数同步
- [ ] 存在 `@media (prefers-reduced-motion: reduce)` 降级

**响应式**
- [ ] 1440 / 1000 / 760 / 480 四个宽度下不破版
- [ ] 瀑布流列数依次为 4 / 3 / 2 / 1
- [ ] ≤980px 时详情页退化为单列堆叠
- [ ] 触屏设备上折叠面板常驻展开，不依赖 hover

**边界**
- [ ] 未修改依赖版本、未重写路由、未动 API 层与 `src-admin/`
- [ ] 未修改 Dockerfile / docker-compose.yml
- [ ] 令牌仍只有 `design-system/tokens.css` 一份真源（`npm run check:design` 通过）
