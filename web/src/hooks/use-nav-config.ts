/*
 * 二开：统一导航配置 Hook
 *
 * 数据链路：Option `NavCustomLinks`(JSON) → /api/status → 本 Hook 解析 → 顶部导航 / 侧边栏。
 * 后台保存后写回 OptionMap，前端下一次拉取 /api/status（刷新页面自动重取）即生效。
 */
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { useStatus } from '@/hooks/use-status'
import {
  parseNavConfig,
  resolveSidebarNav,
  resolveTopNav,
  type NavConfig,
  type NavModuleFlags,
  type ResolvedSidebarLink,
  type ResolvedTopLink,
} from '@/lib/nav-config'
import { useAuthStore } from '@/stores/auth-store'

function readModules(status: Record<string, unknown> | null): NavModuleFlags | null {
  const raw = status?.HeaderNavModules
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as NavModuleFlags
    } catch {
      return null
    }
  }
  if (raw && typeof raw === 'object') return raw as NavModuleFlags
  return null
}

export function useNavConfig(): {
  config: NavConfig
  top: ResolvedTopLink[]
  sidebar: { primary: ResolvedSidebarLink[]; secondary: ResolvedSidebarLink[] }
} {
  const { t } = useTranslation()
  const { status } = useStatus()
  const { auth } = useAuthStore()

  const rawConfig = status?.NavCustomLinks as string | null | undefined
  const docsLink = status?.docs_link as string | undefined
  const isAuthed = !!auth?.user
  const role = (auth?.user?.role as number | undefined) ?? 0

  const config = useMemo(() => parseNavConfig(rawConfig), [rawConfig])
  const modules = useMemo(
    () => readModules(status as Record<string, unknown> | null),
    [status]
  )

  return useMemo(() => {
    const ctx = { t, isAuthed, modules, docsLink, role }
    return {
      config,
      top: resolveTopNav(config, ctx),
      sidebar: resolveSidebarNav(config, ctx),
    }
  }, [config, modules, docsLink, isAuthed, role, t])
}
