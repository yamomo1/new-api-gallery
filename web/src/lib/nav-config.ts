/*
 * 二开：导航配置模型 v2（顶部导航 + 侧边栏）
 *
 * 设计目标：把「内置导航」和「自定义链接」统一成一个**有序列表**，
 * 后台可以改它们的显示名 / 图标 / 跳转地址 / 顺序，也能关闭（enabled=false）；
 * 支持一级菜单带子项（如「创作 → 图片生成 / 视频生成 …」）。
 *
 * 存储：Option `NavCustomLinks`（JSON 字符串），随 /api/status 下发。
 * 兼容：v1 数据是 { top: [...], sidebar: [...] }，解析时会自动迁移到 v2。
 * 地址为空 = 页面尚未开发：导航里保留占位，但点击不跳转。
 */

import {
  BookOpen,
  Compass,
  Crown,
  FileText,
  FolderOpen,
  Frame,
  Home,
  Images,
  Info,
  LayoutDashboard,
  LayoutGrid,
  LifeBuoy,
  Link as LinkIcon,
  ListOrdered,
  Megaphone,
  PenTool,
  Rocket,
  Send,
  Settings,
  Sparkles,
  Store,
  Trophy,
  User,
  Users,
  type LucideIcon,
} from 'lucide-react'

export type NavSurface = 'top' | 'sidebar'
export type NavSidebarGroup = 'primary' | 'secondary'

/** 二级菜单项 */
export type NavChildNode = {
  id: string
  title: string
  titleKey?: string
  /** 为空 = 占位（暂不跳转） */
  url?: string
  enabled: boolean
  external?: boolean
  requireAuth?: boolean
}

/** 一级导航项（内置项与自定义项共用同一结构） */
export type NavItemNode = {
  /** 稳定 id：内置项用 BuiltinNavId，自定义项用 lnk_xxx */
  id: string
  kind: 'builtin' | 'custom'
  enabled: boolean
  /** 覆盖显示名；为空时用 titleKey 的翻译，再为空则用默认名 */
  title?: string
  titleKey?: string
  /** 覆盖跳转地址；为空时用内置默认地址；内置项也没有地址 = 占位 */
  url?: string
  icon?: string
  external?: boolean
  requireAuth?: boolean
  requiredRole?: number
  group?: NavSidebarGroup
  /** 有子项时渲染为可展开的分组（此时 url 可空） */
  children?: NavChildNode[]
}

export type NavConfig = {
  version: 2
  top: NavItemNode[]
  sidebar: NavItemNode[]
}

export type BuiltinNavId =
  | 'home'
  | 'create'
  | 'assets'
  | 'profile'
  | 'creator'
  | 'publish'
  | 'tutorial'
  | 'api'
  | 'gallery'
  | 'console'
  | 'pricing'
  | 'rankings'
  | 'docs'
  | 'about'

type BuiltinChildDef = {
  id: string
  titleKey: string
  defaultTitle: string
  defaultUrl?: string
}

/** 内置项定义（默认值 + 受哪个后台模块开关约束） */
export type BuiltinNavDef = {
  id: BuiltinNavId
  titleKey: string
  defaultTitle: string
  /** 空字符串 = 页面尚未开发（占位，不跳转） */
  defaultUrl: string
  icon: string
  surfaces: NavSurface[]
  group: NavSidebarGroup
  requireAuth?: boolean
  moduleKey?: 'home' | 'console' | 'pricing' | 'rankings' | 'docs' | 'about'
  children?: BuiltinChildDef[]
}

export const BUILTIN_NAV_ITEMS: BuiltinNavDef[] = [
  {
    id: 'home',
    titleKey: 'Home',
    defaultTitle: '首页',
    defaultUrl: '/',
    icon: 'home',
    surfaces: ['top', 'sidebar'],
    group: 'primary',
    moduleKey: 'home',
  },
  {
    id: 'create',
    titleKey: 'Create',
    defaultTitle: '创作',
    defaultUrl: '',
    icon: 'create',
    surfaces: ['sidebar'],
    group: 'primary',
    children: [
      { id: 'create-image', titleKey: 'Image generation', defaultTitle: '图片生成', defaultUrl: '/ai-tool/image-generator' },
      { id: 'create-video', titleKey: 'Video generation', defaultTitle: '视频生成', defaultUrl: '/ai-tool/video-generator' },
      { id: 'create-webui', titleKey: 'WebUI', defaultTitle: 'WebUI' },
      { id: 'create-comfyui', titleKey: 'ComfyUI', defaultTitle: 'ComfyUI' },
      { id: 'create-lora', titleKey: 'Train LoRA', defaultTitle: '训练 LoRA' },
      { id: 'create-ai-app', titleKey: 'AI Apps', defaultTitle: 'AI 应用' },
    ],
  },
  {
    id: 'assets',
    titleKey: 'Assets',
    defaultTitle: '资产',
    defaultUrl: '',
    icon: 'folder',
    surfaces: ['sidebar'],
    group: 'primary',
  },
  {
    id: 'profile',
    titleKey: 'Profile',
    defaultTitle: '个人中心',
    defaultUrl: '',
    icon: 'user',
    surfaces: ['sidebar'],
    group: 'secondary',
    requireAuth: true,
  },
  {
    id: 'creator',
    titleKey: 'Creator center',
    defaultTitle: '创作中心',
    defaultUrl: '',
    icon: 'grid',
    surfaces: ['sidebar'],
    group: 'secondary',
    requireAuth: true,
  },
  {
    id: 'publish',
    titleKey: 'Publish',
    defaultTitle: '发布',
    defaultUrl: '',
    icon: 'send',
    surfaces: ['sidebar'],
    group: 'secondary',
    requireAuth: true,
  },
  {
    id: 'tutorial',
    titleKey: 'Tutorials',
    defaultTitle: '教程',
    defaultUrl: '/docs',
    icon: 'book',
    surfaces: ['sidebar'],
    group: 'secondary',
  },
  {
    id: 'api',
    titleKey: 'API',
    defaultTitle: 'API',
    defaultUrl: '',
    icon: 'file',
    surfaces: ['sidebar'],
    group: 'secondary',
  },
  /* 以下为顶栏沿用项（旧版本默认值，保持兼容） */
  {
    id: 'gallery',
    titleKey: 'Prompt Gallery',
    defaultTitle: '提示词画廊',
    defaultUrl: '/prompt-gallery',
    icon: 'images',
    surfaces: ['sidebar'],
    group: 'primary',
    moduleKey: 'home',
  },
  {
    id: 'console',
    titleKey: 'Console',
    defaultTitle: '控制台',
    defaultUrl: '/dashboard',
    icon: 'dashboard',
    surfaces: ['top', 'sidebar'],
    group: 'secondary',
    requireAuth: true,
    moduleKey: 'console',
  },
  {
    id: 'pricing',
    titleKey: 'Model Square',
    defaultTitle: '模型广场',
    defaultUrl: '/pricing',
    icon: 'store',
    surfaces: ['top', 'sidebar'],
    group: 'primary',
    moduleKey: 'pricing',
  },
  {
    id: 'rankings',
    titleKey: 'Rankings',
    defaultTitle: '排行榜',
    defaultUrl: '/rankings',
    icon: 'trophy',
    surfaces: ['top', 'sidebar'],
    group: 'primary',
    moduleKey: 'rankings',
  },
  {
    id: 'docs',
    titleKey: 'Docs',
    defaultTitle: '文档',
    defaultUrl: '/docs',
    icon: 'book',
    surfaces: ['top', 'sidebar'],
    group: 'secondary',
    moduleKey: 'docs',
  },
  {
    id: 'about',
    titleKey: 'About',
    defaultTitle: '关于',
    defaultUrl: '/about',
    icon: 'info',
    surfaces: ['top', 'sidebar'],
    group: 'secondary',
    moduleKey: 'about',
  },
]

/** 默认顺序（侧栏 = liblib 结构；顶栏保持原有公开导航） */
const DEFAULT_IDS: Record<NavSurface, BuiltinNavId[]> = {
  top: ['home', 'console', 'pricing', 'rankings', 'docs', 'about'],
  sidebar: ['home', 'create', 'assets', 'profile', 'creator', 'publish', 'tutorial', 'api'],
}

export function builtinDef(id: string): BuiltinNavDef | undefined {
  return BUILTIN_NAV_ITEMS.find((it) => it.id === id)
}

function defaultNode(def: BuiltinNavDef): NavItemNode {
  return {
    id: def.id,
    kind: 'builtin',
    enabled: true,
    // 默认直接用中文文案（产品口径以 liblib 结构为准，不让 i18n 把「创作」译成「新建」）；
    // 后台清空标题后才会回退到 titleKey 的翻译。
    title: def.defaultTitle,
    titleKey: def.titleKey,
    icon: def.icon,
    group: def.group,
    ...(def.requireAuth ? { requireAuth: true } : {}),
    ...(def.children
      ? {
          children: def.children.map((c) => ({
            id: c.id,
            title: c.defaultTitle,
            enabled: true,
            ...(c.defaultUrl ? { url: c.defaultUrl } : {}),
          })),
        }
      : {}),
  }
}

/** 默认配置：侧栏用 liblib 结构，顶栏沿用原有公开导航 */
export function buildDefaultNavConfig(): NavConfig {
  const make = (surface: NavSurface): NavItemNode[] =>
    DEFAULT_IDS[surface]
      .map((id) => builtinDef(id))
      .filter((d): d is BuiltinNavDef => !!d)
      .map(defaultNode)
  return { version: 2, top: make('top'), sidebar: make('sidebar') }
}

const MAX_LINKS = 60

export function newNavItemId(): string {
  return `lnk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function toStringArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : []
}

function normalizeChildren(raw: unknown, parentId: string): NavChildNode[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined
  const out: NavChildNode[] = []
  raw.forEach((item, idx) => {
    if (!item || typeof item !== 'object') return
    const r = item as Record<string, unknown>
    const title = typeof r.title === 'string' ? r.title.trim() : ''
    const url = typeof r.url === 'string' ? r.url.trim() : ''
    if (!title && !url) return
    out.push({
      id: typeof r.id === 'string' && r.id ? r.id : `${parentId}-child-${idx}`,
      title: title || url,
      ...(typeof r.titleKey === 'string' && r.titleKey ? { titleKey: r.titleKey } : {}),
      ...(url ? { url } : {}),
      enabled: r.enabled !== false,
      ...(r.external === true ? { external: true } : {}),
      ...(r.requireAuth === true ? { requireAuth: true } : {}),
    })
  })
  return out.length ? out : undefined
}

function normalizeNode(raw: unknown): NavItemNode | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const id = typeof r.id === 'string' && r.id.trim() !== '' ? r.id : newNavItemId()
  const def = builtinDef(id)
  const explicitKind =
    r.kind === 'builtin' || r.kind === 'custom' ? r.kind : undefined
  // 兜底：id 命中内置目录即视为内置（v1 自定义项是 lnk_ 前缀，不会误判）
  const kind: NavItemNode['kind'] = explicitKind ?? (def ? 'builtin' : 'custom')
  const url = typeof r.url === 'string' ? r.url.trim() : ''
  const node: NavItemNode = {
    id,
    kind: kind === 'builtin' && def ? 'builtin' : 'custom',
    enabled: r.enabled !== false,
  }
  if (typeof r.title === 'string' && r.title !== '') node.title = r.title
  if (typeof r.titleKey === 'string' && r.titleKey !== '') node.titleKey = r.titleKey
  if (url !== '') node.url = url
  if (typeof r.icon === 'string' && r.icon !== '') node.icon = r.icon
  if (r.external === true) node.external = true
  if (r.requireAuth === true) node.requireAuth = true
  if (typeof r.requiredRole === 'number') node.requiredRole = r.requiredRole
  const group = r.group
  if (group === 'primary' || group === 'secondary') node.group = group
  else if (def && node.kind === 'builtin') node.group = def.group

  const children = normalizeChildren(r.children, id)
  if (children) node.children = children

  if (!nodeEnough(node)) return null
  return node
}

/** 至少要有个能落地的地址、内置身份或子项 */
function nodeEnough(node: NavItemNode): boolean {
  if (node.kind === 'builtin') return !!builtinDef(node.id)
  if (node.children?.length) return true
  return !!node.url && node.url.trim() !== ''
}

/**
 * 解析配置。规则：
 * - v2（有 version:2）→ 直接规范化
 * - v1（{top:[],sidebar:[]}）→ 以内置默认顺序为基准，把自定义项按存储顺序追加在末尾
 * - 空值 → 默认配置
 * 任何未知/失效项都会被丢弃，避免脏数据把导航打挂。
 */
export function parseNavConfig(raw: string | null | undefined): NavConfig {
  const defaults = buildDefaultNavConfig()
  if (!raw || raw.trim() === '') return defaults
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return defaults
  }
  if (!parsed || typeof parsed !== 'object') return defaults
  const obj = parsed as Record<string, unknown>

  const merge = (surface: NavSurface, storedList: unknown[], legacy: boolean): NavItemNode[] => {
    const defaultList = defaults[surface]
    const normalized = storedList
      .map((item) => normalizeNode(item))
      .filter((n): n is NavItemNode => !!n)

    const byId = new Map<string, NavItemNode>()
    for (const n of normalized) if (!byId.has(n.id)) byId.set(n.id, n)

    // v1 老数据里只有自定义链接，没有内置项的信息 → 内置项保持默认顺序在前，
    // 老的自定义链接按原顺序追加在末尾（避免升级后自定义项突然跑到最前面）。
    if (legacy) {
      const extras = normalized.filter((n) => n.kind === 'custom')
      return [...defaultList, ...extras].slice(0, MAX_LINKS)
    }

    const out: NavItemNode[] = []
    for (const n of normalized) {
      const def = builtinDef(n.id)
      if (def) {
        if (!def.surfaces.includes(surface)) continue
        out.push(applyBuiltinDefaults(n, def))
      } else {
        out.push(n)
      }
    }
    // 存储里没有的内置项，按默认顺序补到末尾（新增功能也能出现）
    for (const d of defaultList) {
      if (!byId.has(d.id)) out.push(d)
    }
    return out.slice(0, MAX_LINKS)
  }

  const legacy = obj.version !== 2
  const hasAny = Array.isArray(obj.top) || Array.isArray(obj.sidebar)
  if (!hasAny) return defaults

  return {
    version: 2,
    top: merge('top', toStringArray(obj.top), legacy),
    sidebar: merge('sidebar', toStringArray(obj.sidebar), legacy),
  }
}

function applyBuiltinDefaults(node: NavItemNode, def: BuiltinNavDef): NavItemNode {
  return {
    ...node,
    kind: 'builtin',
    titleKey: node.titleKey || def.titleKey,
    icon: node.icon || def.icon,
    group: node.group || def.group,
    ...(node.children ? {} : def.children ? { children: defaultNode(def).children } : {}),
    ...(def.requireAuth && node.requireAuth === undefined
      ? { requireAuth: true }
      : {}),
  }
}

export function serializeNavConfig(config: NavConfig): string {
  return JSON.stringify({
    version: 2,
    top: config.top.map(stripNode),
    sidebar: config.sidebar.map(stripNode),
  })
}

function stripNode(node: NavItemNode): NavItemNode {
  const out: NavItemNode = {
    id: node.id,
    kind: node.kind,
    enabled: node.enabled !== false,
  }
  if (node.title) out.title = node.title
  if (node.titleKey) out.titleKey = node.titleKey
  if (node.url) out.url = node.url
  if (node.icon) out.icon = node.icon
  if (node.external) out.external = true
  if (node.requireAuth) out.requireAuth = true
  if (node.requiredRole !== undefined) out.requiredRole = node.requiredRole
  if (node.group) out.group = node.group
  if (node.children?.length) out.children = node.children
  return out
}

export function isWithinNavLimit(config: NavConfig): boolean {
  return config.top.length + config.sidebar.length < MAX_LINKS
}

/* ── 图标 ── */

const ICON_MAP: Record<string, LucideIcon> = {
  home: Home,
  create: PenTool,
  images: Images,
  'layout-grid': LayoutGrid,
  grid: LayoutGrid,
  frame: Frame,
  dashboard: LayoutDashboard,
  store: Store,
  trophy: Trophy,
  book: BookOpen,
  info: Info,
  file: FileText,
  folder: FolderOpen,
  send: Send,
  user: User,
  settings: Settings,
  sparkles: Sparkles,
  rocket: Rocket,
  list: ListOrdered,
  lifebuoy: LifeBuoy,
  users: Users,
  crown: Crown,
  compass: Compass,
  megaphone: Megaphone,
}

export const NAV_ICON_OPTIONS: { id: string; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'create', label: 'Create' },
  { id: 'images', label: 'Images' },
  { id: 'grid', label: 'Grid' },
  { id: 'frame', label: 'Frame' },
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'store', label: 'Store' },
  { id: 'trophy', label: 'Trophy' },
  { id: 'book', label: 'Book' },
  { id: 'info', label: 'Info' },
  { id: 'file', label: 'File' },
  { id: 'folder', label: 'Folder' },
  { id: 'send', label: 'Send' },
  { id: 'user', label: 'User' },
  { id: 'sparkles', label: 'Sparkles' },
  { id: 'rocket', label: 'Rocket' },
  { id: 'list', label: 'List' },
  { id: 'lifebuoy', label: 'Lifebuoy' },
  { id: 'users', label: 'Users' },
  { id: 'crown', label: 'Crown' },
  { id: 'compass', label: 'Compass' },
  { id: 'megaphone', label: 'Megaphone' },
  { id: 'settings', label: 'Settings' },
]

export function resolveNavIcon(name?: string): LucideIcon {
  if (name && ICON_MAP[name]) return ICON_MAP[name]
  return LinkIcon
}

/* ── 解析成渲染态 ── */

export type NavModuleFlags = {
  home?: boolean
  console?: boolean
  pricing?: { enabled?: boolean; requireAuth?: boolean }
  rankings?: { enabled?: boolean; requireAuth?: boolean }
  docs?: boolean
  about?: boolean
}

export type ResolvedTopLink = {
  title: string
  href: string
  external?: boolean
  requiresAuth?: boolean
}

export type ResolvedSidebarLink = {
  id: string
  title: string
  /** 空字符串 = 占位项（页面未开发），点击不跳转 */
  href: string
  icon?: LucideIcon
  external?: boolean
  requiresAuth?: boolean
  group: NavSidebarGroup
  children?: ResolvedSidebarLink[]
}

type ResolveCtx = {
  t: (key: string, opts?: Record<string, unknown>) => string
  isAuthed: boolean
  modules?: NavModuleFlags | null
  docsLink?: string
  role?: number
}

function moduleAllows(def: BuiltinNavDef | undefined, modules?: NavModuleFlags | null): boolean {
  if (!def?.moduleKey) return true
  const m = modules as Record<string, unknown> | undefined
  if (!m) return true
  const value = m[def.moduleKey]
  if (value === undefined || value === null) return true
  if (typeof value === 'boolean') return value
  if (typeof value === 'object') {
    const o = value as { enabled?: boolean }
    return o.enabled !== false
  }
  return true
}

function nodeTitle(node: NavItemNode, def: BuiltinNavDef | undefined, ctx: ResolveCtx): string {
  if (node.title) return node.title
  if (node.titleKey) {
    const translated = ctx.t(node.titleKey)
    if (translated && translated !== node.titleKey) return translated
  }
  if (def) return ctx.t(def.titleKey, { defaultValue: def.defaultTitle })
  return node.url ?? ''
}

function nodeUrl(node: NavItemNode, def: BuiltinNavDef | undefined, ctx: ResolveCtx): string {
  if (node.url) return node.url
  if (def?.id === 'docs' && ctx.docsLink) return ctx.docsLink
  return def?.defaultUrl ?? ''
}

function nodeVisible(node: NavItemNode, ctx: ResolveCtx): boolean {
  if (!node.enabled) return false
  if (node.requireAuth && !ctx.isAuthed) return false
  if (node.requiredRole !== undefined && (ctx.role ?? 0) < node.requiredRole) return false
  const def = builtinDef(node.id)
  if (def && !moduleAllows(def, ctx.modules)) return false
  return true
}

/** 顶部导航：只保留有地址的项（顶栏不放占位死链） */
export function resolveTopNav(config: NavConfig, ctx: ResolveCtx): ResolvedTopLink[] {
  const out: ResolvedTopLink[] = []
  for (const node of config.top) {
    if (!nodeVisible(node, ctx)) continue
    const def = builtinDef(node.id)
    const href = nodeUrl(node, def, ctx)
    if (!href) continue
    out.push({
      title: nodeTitle(node, def, ctx),
      href,
      external: node.external || /^https?:\/\//i.test(href),
      requiresAuth: node.requireAuth,
    })
  }
  return out
}

/** 侧边栏：按 group 分出主组 / 次组；无地址的项保留为占位 */
export function resolveSidebarNav(
  config: NavConfig,
  ctx: ResolveCtx
): { primary: ResolvedSidebarLink[]; secondary: ResolvedSidebarLink[] } {
  const primary: ResolvedSidebarLink[] = []
  const secondary: ResolvedSidebarLink[] = []
  for (const node of config.sidebar) {
    if (!nodeVisible(node, ctx)) continue
    const def = builtinDef(node.id)
    const href = nodeUrl(node, def, ctx)
    const children = (node.children ?? [])
      .filter((c) => c.enabled !== false)
      .filter((c) => !c.requireAuth || ctx.isAuthed)
      .map<ResolvedSidebarLink>((c) => ({
        id: c.id,
        title: c.title,
        href: c.url ?? '',
        group: 'primary',
        external: c.external || /^https?:\/\//i.test(c.url ?? ''),
      }))
    // 无地址且无子项 = 页面未开发的占位项，仍然渲染（点击不跳转）
    const link: ResolvedSidebarLink = {
      id: node.id,
      title: nodeTitle(node, def, ctx),
      href,
      icon: resolveNavIcon(node.icon ?? def?.icon),
      external: node.external || /^https?:\/\//i.test(href),
      requiresAuth: node.requireAuth,
      group: node.group ?? def?.group ?? 'primary',
      ...(children.length ? { children } : {}),
    }
    if (link.group === 'secondary') secondary.push(link)
    else primary.push(link)
  }
  return { primary, secondary }
}
