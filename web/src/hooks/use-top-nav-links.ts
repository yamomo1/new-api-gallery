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
import { useMemo } from 'react'

import { useNavConfig } from '@/hooks/use-nav-config'

export type TopNavLink = {
  title: string
  href: string
  disabled?: boolean
  requiresAuth?: boolean
  external?: boolean
}

/**
 * 顶部导航链接。
 *
 * 二开改造后，顺序 / 显示名 / 图标 / 地址 / 是否显示全部由后台
 * 「站点设置 → 导航链接」维护（Option `NavCustomLinks`，v2 结构），
 * 本 Hook 只做「配置 → 渲染数据」的解析：
 * - `enabled:false` → 不出现
 * - 后台模块开关（HeaderNavModules）关闭 → 不出现
 * - `requireAuth` 且未登录 → 不出现
 */
export function useTopNavLinks(): TopNavLink[] {
  const { top } = useNavConfig()
  return useMemo(
    () =>
      top.map((l) => ({
        title: l.title,
        href: l.href,
        external: l.external,
        requiresAuth: l.requiresAuth,
      })),
    [top]
  )
}
