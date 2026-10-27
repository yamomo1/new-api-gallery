/*
 * 二开：读取后台维护的导航自定义链接（顶部导航 / 侧边栏）
 *
 * 数据来自 /api/status 的 NavCustomLinks 字段（option 存储）。
 * 过滤规则：enabled 且（未要求登录 或 已登录）。标题优先用 titleKey 走 i18n 翻译。
 */
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { useStatus } from '@/hooks/use-status'
import { useAuthStore } from '@/stores/auth-store'
import {
  type CustomNavLink,
  parseNavCustomLinks,
  resolveNavIcon,
} from '@/lib/nav-custom-links'
import type { NavLink, TopNavLink } from '@/components/layout/types'

function resolveTitle(link: CustomNavLink, t: (k: string) => string): string {
  if (link.titleKey) {
    const translated = t(link.titleKey)
    // i18n 缺失 key 会原样返回 key，这时回退到已存 title 文本
    if (translated && translated !== link.titleKey) return translated
  }
  return link.title || link.url
}

export function useNavCustomLinks(): {
  top: TopNavLink[]
  sidebar: NavLink[]
} {
  const { t } = useTranslation()
  const { status } = useStatus()
  const { auth } = useAuthStore()

  const raw = status?.NavCustomLinks as string | null | undefined
  const isAuthed = !!auth?.user

  return useMemo(() => {
    const config = parseNavCustomLinks(raw)

    const top: TopNavLink[] = config.top
      .filter((l) => l.enabled && (!l.requireAuth || isAuthed))
      .map((l) => ({
        title: resolveTitle(l, t),
        href: l.url,
        external: !!l.external,
        requiresAuth: !!l.requireAuth,
      }))

    const sidebar: NavLink[] = config.sidebar
      .filter((l) => l.enabled && (!l.requireAuth || isAuthed))
      .map((l) => ({
        title: resolveTitle(l, t),
        url: l.url,
        icon: resolveNavIcon(l.icon),
      }))

    return { top, sidebar }
  }, [raw, isAuthed, t])
}
