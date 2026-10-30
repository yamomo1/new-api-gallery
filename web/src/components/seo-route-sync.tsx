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
import { useRouterState } from '@tanstack/react-router'
import { useEffect } from 'react'

import { applySeoForPath, loadSeoConfig } from '@/lib/seo'

/**
 * 路由变化时把 head 里的 title/description/canonical 同步成当前页面的。
 * 挂在根组件上，全站只需一处；具体文案全部来自后台 SEO 配置，
 * 前端不重复维护一套文案。
 *
 * 详情页会在拿到数据后用 setSeoOverride 登记自己的标题，这里通过
 * applySeoForPath 统一走「覆盖优先」，避免两边互相盖回去。
 */
export function SeoRouteSync() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  useEffect(() => {
    let cancelled = false
    void loadSeoConfig().then((cfg) => {
      if (cancelled || !cfg) return
      applySeoForPath(cfg, pathname)
    })
    return () => {
      cancelled = true
    }
  }, [pathname])

  return null
}
