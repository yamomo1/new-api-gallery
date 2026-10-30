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
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'

import { installBuildMetadata } from '@/lib/build-metadata'
import { applyFaviconToDom } from '@/lib/dom-utils'
import '@/lib/dayjs'
import { initializeFrontendCache } from '@/lib/frontend-cache'
import { createAppQueryClient } from '@/lib/query-client'
import { readCachedStatus, statusQueryOptions } from '@/lib/status-query'

import { DirectionProvider } from './context/direction-provider'
import { FontProvider } from './context/font-provider'
import { ThemeProvider } from './context/theme-provider'
import { bootstrapI18n } from './i18n/config'
// Generated Routes
import { routeTree } from './routeTree.gen'

// Styles
import './styles/index.css'

// Ensure VChart theme is initialized before any chart mounts (prevents white default theme flash)
// VChart theme is driven by our ThemeProvider (html.light/html.dark) via per-chart `theme` prop.
initializeFrontendCache()
installBuildMetadata()

const queryClient = createAppQueryClient(() => {
  void router.navigate({ to: '/500' })
})

// Create a new router instance
const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: 'intent',
  defaultPreloadStaleTime: 0,
})

// Register the router instance for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

// Render the app
const rootElement = document.querySelector<HTMLElement>('#root')
if (!rootElement) {
  throw new Error('Root element not found')
}
// 提到具名常量：renderApp 是延迟执行的闭包，闭包内 TS 不保留上面的 null 收窄
const mountPoint: HTMLElement = rootElement
// Set document.title and favicon from cached status, then refresh from network
;(function initSystemBranding() {
  try {
    if (typeof window === 'undefined' || typeof document === 'undefined') return
    // 服务端已按路径注入 SEO 标题（service/seo）时不能再被站名覆盖，
    // 否则每页 title 都会退化成「一幕AI」，SEO 白做。
    const seoInjected = Boolean(
      document.querySelector('meta[name="x-seo-title"]')
    )
    const apply = (name: string) => {
      if (seoInjected) return
      document.title = name
      const metaTitle = document.querySelector(
        'meta[name="title"]'
      ) as HTMLMetaElement | null
      if (metaTitle) metaTitle.setAttribute('content', name)
    }
    // Cache-first
    const cached = readCachedStatus()
    if (cached?.system_name) apply(cached.system_name as string)
    if (cached?.logo) applyFaviconToDom(cached.logo as string)

    // Background refresh through the shared cache. This primes ['status']
    // before React mounts, so the root guard and every status consumer reuse
    // this one request instead of firing their own. `fetchStatus` owns the
    // localStorage write and the system-config store sync.
    queryClient
      .ensureQueryData(statusQueryOptions)
      .then((s) => {
        if (s?.system_name) apply(s.system_name as string)
        if (s?.logo) applyFaviconToDom(s.logo as string)
      })
      .catch(() => {
        /* empty */
      })
  } catch {
    /* empty */
  }
})()
function renderApp() {
  if (mountPoint.innerHTML) return
  const root = ReactDOM.createRoot(mountPoint)
  root.render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <FontProvider>
            <DirectionProvider>
              <RouterProvider router={router} />
            </DirectionProvider>
          </FontProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </StrictMode>
  )
}

// 等当前语言的词条到位再渲染：语言包是按需 import 的（见 i18n/config.ts），
// 提前渲染会先闪一眼英文。失败也要渲染，不能因为语言包卡住整站。
void bootstrapI18n().finally(renderApp)
