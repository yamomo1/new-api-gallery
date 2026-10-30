/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

/**
 * 前端 SEO 同步
 * ------------------------------------------------------------------
 * 首屏（含爬虫抓取）由 Go 的 service/seo 直接注入 <head>，这里是「补充」：
 * SPA 内部跳转不会重新请求 HTML，标题和描述会停在上一页 —— 这既影响用户
 * 收藏/分享，也影响会执行 JS 的爬虫。所以每次路由变化都按同一份后端配置
 * 重写一遍 head，保证「服务端注入」与「客户端同步」用的是同一个真源。
 */

export type SeoPageMeta = {
  title?: string
  description?: string
  keywords?: string
  robots?: string
  inSitemap?: boolean
  changeFreq?: string
  priority?: number
}

export type SeoConfig = {
  siteName: string
  brand: string
  baseUrl: string
  titleTemplate: string
  defaultTitle: string
  description: string
  keywords: string
  ogImage: string
  twitter?: string
  locale: string
  robots: string
  allowAiCrawlers?: boolean
  pages: Record<string, SeoPageMeta>
}

let cached: SeoConfig | null = null
let inflight: Promise<SeoConfig | null> | null = null

/** 拉取 SEO 配置（模块级缓存：一次会话只请求一次）。 */
export async function loadSeoConfig(): Promise<SeoConfig | null> {
  if (cached) return cached
  if (inflight) return inflight
  inflight = (async () => {
    try {
      const res = await fetch('/api/seo/config', {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      })
      if (!res.ok) return null
      const json = (await res.json()) as { data?: SeoConfig }
      cached = json?.data ?? null
      return cached
    } catch {
      return null
    } finally {
      inflight = null
    }
  })()
  return inflight
}

/** 供后台保存后立即失效（同页面内）。 */
export function invalidateSeoConfigCache() {
  cached = null
}

export function normalizePath(path: string): string {
  let p = (path || '/').split('?')[0].split('#')[0]
  if (!p.startsWith('/')) p = '/' + p
  if (p.length > 1) p = p.replace(/\/+$/, '')
  return p || '/'
}

const PRIVATE_PREFIXES = [
  '/console',
  '/system-settings',
  '/admin',
  '/login',
  '/sign-in',
  '/register',
  '/sign-up',
  '/reset',
  '/oauth',
  '/setup',
]

/** 后台/登录类页面的标题后缀，避免整个后台都顶着站点默认标题 */
const PRIVATE_LABELS: Record<string, string> = {
  '/console': '控制台',
  '/system-settings': '系统设置',
  '/admin': '管理后台',
  '/login': '登录',
  '/sign-in': '登录',
  '/register': '注册',
  '/sign-up': '注册',
  '/reset': '找回密码',
  '/setup': '初始化',
}

function privateLabel(path: string): string | null {
  const p = normalizePath(path)
  for (const [prefix, label] of Object.entries(PRIVATE_LABELS)) {
    if (p === prefix || p.startsWith(prefix + '/')) return label
  }
  return null
}

function isPrivatePath(path: string): boolean {
  const p = normalizePath(path)
  return PRIVATE_PREFIXES.some((prefix) => p === prefix || p.startsWith(prefix + '/'))
}

/** 页面配置：先精确匹配，再按前缀兜底（/prompt-gallery/123 → /prompt-gallery）。 */
export function pageMetaFor(
  cfg: SeoConfig,
  path: string
): SeoPageMeta {
  const p = normalizePath(path)
  if (cfg.pages?.[p]) return cfg.pages[p]
  for (const [key, meta] of Object.entries(cfg.pages || {})) {
    if (key !== '/' && p.startsWith(key + '/')) return meta
  }
  return {}
}

export type ResolvedSeo = {
  title: string
  description: string
  keywords: string
  robots: string
  canonical: string
  image: string
  ogType: string
}

/**
 * 单页运行时覆盖：详情页（/prompt-gallery/:id）的标题/描述来自数据库记录，
 * 不可能写进后台的静态页面配置里，所以由页面在拿到数据后自己登记。
 */
export type SeoOverride = {
  title?: string
  description?: string
  keywords?: string
  robots?: string
  image?: string
  ogType?: string
}

const overrides = new Map<string, SeoOverride>()

/** 登记/清除某条路径的运行时覆盖（path 传 null 表示清除）。 */
export function setSeoOverride(path: string, meta: SeoOverride | null) {
  const p = normalizePath(path)
  if (meta) overrides.set(p, meta)
  else overrides.delete(p)
}

export function resolveSeo(
  cfg: SeoConfig,
  path: string,
  override?: SeoOverride
): ResolvedSeo {
  const p = normalizePath(path)
  const page = pageMetaFor(cfg, p)
  const title0 = override?.title ?? page.title
  let title = cfg.defaultTitle
  if (title0) {
    title =
      title0.includes(cfg.siteName) || title0.includes(cfg.brand)
        ? title0
        : (cfg.titleTemplate || '{page}')
            .replace('{page}', title0)
            .replace('{site}', cfg.siteName)
  }
  const isPrivate = isPrivatePath(p)
  // 后台页面没配 title 时用「分区名 · 站名」，别让所有后台页都叫同一个默认标题
  if (!title0 && isPrivate) {
    const label = privateLabel(p)
    if (label) title = `${label} · ${cfg.siteName}`
  }
  const robots =
    override?.robots ||
    page.robots ||
    (isPrivate ? 'noindex,follow' : cfg.robots || 'index,follow')
  const base = (cfg.baseUrl || window.location.origin).replace(/\/+$/, '')
  return {
    title,
    description: override?.description ?? page.description ?? cfg.description,
    keywords: override?.keywords ?? page.keywords ?? cfg.keywords,
    robots,
    canonical: p === '/' ? base + '/' : base + p,
    image: override?.image || cfg.ogImage,
    ogType: override?.ogType || 'website',
  }
}

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  if (!content) return
  let el = document.head.querySelector<HTMLMetaElement>(
    `meta[${attr}="${key}"]`
  )
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function upsertCanonical(href: string) {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', 'canonical')
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

/** 把某一页的 SEO 写进当前文档头。 */
export function applySeo(cfg: SeoConfig, path: string, override?: SeoOverride) {
  const meta = resolveSeo(cfg, path, override)
  document.title = meta.title
  // 与 index.html 里的 <meta name="title"> 保持一致，部分老爬虫仍读它
  upsertMeta('name', 'title', meta.title)
  upsertMeta('name', 'description', meta.description)
  upsertMeta('name', 'keywords', meta.keywords)
  upsertMeta('name', 'robots', meta.robots)
  upsertMeta('property', 'og:type', meta.ogType)
  upsertMeta('property', 'og:title', meta.title)
  upsertMeta('property', 'og:description', meta.description)
  upsertMeta('property', 'og:url', meta.canonical)
  upsertMeta('property', 'og:site_name', cfg.siteName)
  upsertMeta('property', 'og:image', meta.image)
  upsertMeta('name', 'twitter:card', 'summary_large_image')
  upsertMeta('name', 'twitter:title', meta.title)
  upsertMeta('name', 'twitter:description', meta.description)
  upsertMeta('name', 'twitter:image', meta.image)
  upsertCanonical(meta.canonical)
}

/**
 * 按路径 + 已登记的运行时覆盖写 head。
 * 路由同步（SeoRouteSync）与详情页共用这一个入口，避免两边互相覆盖。
 */
export function applySeoForPath(cfg: SeoConfig, path: string) {
  applySeo(cfg, path, overrides.get(normalizePath(path)))
}
