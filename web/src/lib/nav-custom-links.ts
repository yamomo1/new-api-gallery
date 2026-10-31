/*
 * 二开：导航自定义链接数据层
 *
 * 后台「站点设置 → 导航链接」维护一个 JSON 配置，分顶部导航（top）与侧边栏（sidebar）
 * 两组。每条链接可自定义标题/地址，并支持「预设快捷选择」：直接把已开发的功能地址填进来，
 * 避免手敲路径。
 */

import {
  Boxes,
  FileText,
  FolderOpen,
  Info,
  Frame,
  Home,
  Images,
  LayoutDashboard,
  LayoutGrid,
  LifeBuoy,
  Link as LinkIcon,
  ListOrdered,
  type LucideIcon,
  Plug,
  Rocket,
  Settings,
  Trophy,
} from 'lucide-react'

/** 侧边栏可选分组。id 与 useSidebarData 中内置分组保持一致 */
export type SidebarGroupKey =
  | 'chat'
  | 'general'
  | 'personal'
  | 'admin'
  | 'custom'

/** 分组下拉选项：id + i18n key（复用侧边栏既有分组标题） */
export const SIDEBAR_GROUP_OPTIONS: {
  id: SidebarGroupKey
  titleKey: string
}[] = [
  { id: 'chat', titleKey: 'Chat' },
  { id: 'general', titleKey: 'General' },
  { id: 'personal', titleKey: 'Personal' },
  { id: 'admin', titleKey: 'Admin' },
  { id: 'custom', titleKey: 'Custom' },
]

/** 侧边栏链接可见角色选项：value 为最低可见角色（ROLE 值），undefined = 不限 */
export const SIDEBAR_ROLE_OPTIONS: {
  value: number | undefined
  titleKey: string
}[] = [
  { value: undefined, titleKey: 'Everyone' },
  { value: 1, titleKey: 'User' },
  { value: 10, titleKey: 'Admin' },
  { value: 100, titleKey: 'Super Admin' },
]

/** 单条自定义链接 */
export type CustomNavLink = {
  /** 稳定 id（用于 key / 排序，前端生成） */
  id: string
  /** 展示标题。若 titleKey 存在则运行时用 i18n 翻译，否则用此文本 */
  title: string
  /** i18n key（预设项填写，运行时优先于 title） */
  titleKey?: string
  /** 跳转地址：站内用 SPA 路径（/xxx），外链用 http(s):// */
  url: string
  /** 是否启用 */
  enabled: boolean
  /** 外链：新窗口打开 + rel=noopener */
  external?: boolean
  /** 仅登录后可见 */
  requireAuth?: boolean
  /** 侧边栏图标（lucide 名，见 ICON_MAP）；顶部导航忽略 */
  icon?: string
  /** 侧边栏：归属分组（chat/general/personal/admin/custom）。顶部导航忽略 */
  group?: SidebarGroupKey
  /** 侧边栏：可见最低角色（ROLE 值）；未设置则所有人可见。顶部导航忽略 */
  requiredRole?: number
}

export type NavCustomLinksConfig = {
  top: CustomNavLink[]
  sidebar: CustomNavLink[]
}

export const NAV_CUSTOM_LINKS_DEFAULT: NavCustomLinksConfig = {
  top: [],
  sidebar: [],
}

/** 预设项：后台「添加链接」下拉里快速选择，自动填入标题与地址 */
export type NavLinkPreset = {
  id: string
  /** i18n key，添加时写入 titleKey */
  titleKey: string
  url: string
  requireAuth?: boolean
  icon?: string
}

export const NAV_LINK_PRESETS: NavLinkPreset[] = [
  { id: 'home', titleKey: 'Home', url: '/' },
  { id: 'gallery', titleKey: 'Prompt Gallery', url: '/prompt-gallery', icon: 'images' },
  { id: 'my-works', titleKey: 'My works', url: '/my-works', requireAuth: true, icon: 'folder' },
  { id: 'canvas', titleKey: 'Canvas Studio', url: '/canvas', icon: 'frame' },
  { id: 'my-canvases', titleKey: 'My Canvases', url: '/my-canvases', requireAuth: true, icon: 'frame' },
  { id: 'console', titleKey: 'Console', url: '/dashboard' },
  { id: 'model-square', titleKey: 'Model Square', url: '/pricing' },
  { id: 'rankings', titleKey: 'Rankings', url: '/rankings' },
  { id: 'about', titleKey: 'About', url: '/about' },
  { id: 'docs', titleKey: 'Docs', url: '/docs' },
  { id: 'gallery-review', titleKey: 'Gallery review', url: '/admin/prompt-gallery', requireAuth: true, icon: 'images' },
  { id: 'home-settings', titleKey: 'Home Settings', url: '/admin/home-settings', requireAuth: true, icon: 'home' },
  { id: 'system-settings', titleKey: 'System Settings', url: '/system-settings/site', requireAuth: true, icon: 'settings' },
]

export function parseNavCustomLinks(
  value: string | null | undefined
): NavCustomLinksConfig {
  if (!value || value.trim() === '') return { top: [], sidebar: [] }
  try {
    const parsed = JSON.parse(value) as Partial<NavCustomLinksConfig>
    return {
      top: Array.isArray(parsed.top) ? parsed.top.filter(isValidLink) : [],
      sidebar: Array.isArray(parsed.sidebar)
        ? parsed.sidebar.filter(isValidLink)
        : [],
    }
  } catch {
    return { top: [], sidebar: [] }
  }
}

export function serializeNavCustomLinks(config: NavCustomLinksConfig): string {
  return JSON.stringify({
    top: config.top.map(stripLink),
    sidebar: config.sidebar.map(stripLink),
  })
}

/** 生成一个稳定 id（无需后端，前端随机即可） */
export function newNavLinkId(): string {
  return `lnk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

const MAX_LINKS = 50

export function isWithinLinkLimit(config: NavCustomLinksConfig): boolean {
  return config.top.length + config.sidebar.length < MAX_LINKS
}

/** 图标名 → lucide 组件（侧边栏用） */
const ICON_MAP: Record<string, LucideIcon> = {
  home: Home,
  images: Images,
  'layout-grid': LayoutGrid,
  frame: Frame,
  dashboard: LayoutDashboard,
  box: Boxes,
  trophy: Trophy,
  about: Info,
  file: FileText,
  folder: FolderOpen,
  settings: Settings,
  plug: Plug,
  rocket: Rocket,
  list: ListOrdered,
  lifebuoy: LifeBuoy,
}

export function resolveNavIcon(name?: string): LucideIcon {
  if (name && ICON_MAP[name]) return ICON_MAP[name]
  return LinkIcon
}

function isValidLink(link: unknown): link is CustomNavLink {
  if (!link || typeof link !== 'object') return false
  const l = link as Record<string, unknown>
  return typeof l.url === 'string' && l.url.trim() !== ''
}

function stripLink(link: CustomNavLink): CustomNavLink {
  const out: CustomNavLink = {
    id: link.id || newNavLinkId(),
    title: link.title ?? '',
    url: link.url,
    enabled: link.enabled !== false,
  }
  if (link.titleKey) out.titleKey = link.titleKey
  if (link.external) out.external = true
  if (link.requireAuth) out.requireAuth = true
  if (link.icon) out.icon = link.icon
  if (link.group) out.group = link.group
  if (link.requiredRole !== undefined) out.requiredRole = link.requiredRole
  return out
}
