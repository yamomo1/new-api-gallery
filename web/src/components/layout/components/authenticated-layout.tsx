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
import { CommandMenu } from '@/components/command-menu'
import { AnimatedOutlet } from '@/components/page-transition'
import { SkipToMain } from '@/components/skip-to-main'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { LayoutProvider } from '@/context/layout-provider'
import { SearchProvider } from '@/context/search-provider'
import { getCookie } from '@/lib/cookies'
import { cn } from '@/lib/utils'

import { AppHeader } from './app-header'
import { AppSidebar } from './app-sidebar'

type AuthenticatedLayoutProps = {
  children?: React.ReactNode
}

export function AuthenticatedLayout(props: AuthenticatedLayoutProps) {
  const defaultOpen = getCookie('sidebar_state') !== 'false'

  return (
    <LayoutProvider>
      <SearchProvider>
        <SidebarProvider defaultOpen={defaultOpen} className='flex-col'>
          <SkipToMain />
          <AppHeader />
          <div className='flex min-h-0 w-full flex-1'>
            <AppSidebar />
            <SidebarInset
              className={cn(
                '@container/content',
                'h-[calc(100svh-var(--app-header-height,0px))]',
                'min-h-0 overflow-hidden',
                'peer-data-[variant=inset]:h-[calc(100svh-var(--app-header-height,0px)-(var(--spacing)*4))]'
              )}
            >
              {/*
                统一的可滚动内容槽。
                坑（2026-10-30）：这里原来直接渲染 children，而 SidebarInset
                本身是 `overflow-hidden` + 固定视口高度。系统设置下多数页面
                （内容标识 / SEO / 页面写的是裸 <div className="p-6">）没有
                自己的滚动容器，内容一超出就被裁掉，再被根布局 `__root.tsx`
                里的 SiteFooter 盖住底部 —— 表现为「设置页没有滚动条、底部
                信息被页脚遮住」。
                给一个 `min-h-0 flex-1 overflow-y-auto` 的槽之后，所有子页面
                无需各自处理就能滚动；已经自带滚动容器的页面（如
                section-page-layout 的 `overflow-auto`）内层滚动优先，
                不会出现双滚动条。
              */}
              <div className='flex min-h-0 w-full flex-1 flex-col overflow-y-auto'>
                {props.children ?? <AnimatedOutlet />}
              </div>
            </SidebarInset>
          </div>
        </SidebarProvider>
        <CommandMenu />
      </SearchProvider>
    </LayoutProvider>
  )
}
