import type { CSSProperties, ReactNode } from 'react'

import {
  SidebarInset,
  SidebarProvider,
} from '@/components/ui/sidebar'

import { GallerySidebar } from './gallery-sidebar'
import { GalleryTopBar } from './gallery-topbar'

type GalleryLayoutProps = {
  children: ReactNode
}

/**
 * 画廊/详情类页面布局（对齐 liblib.art 桌面端，实测参数还原）：
 * - 顶栏 56px fixed 全宽：居中搜索框 / 通知 + 登录态（无边框）
 * - 品牌区（LOGO/站名/折叠按钮）在侧栏头部：展开=LOGO+站名+按钮一行；
 *   收起=LOGO 放大居中，悬浮收起区域时按钮出现在 LOGO 旁（对齐 liblib 交互）
 * - 侧栏 200px 白底贴边，从顶栏下沿起全高（ui/sidebar 原生支持 --app-header-height）
 * - 复用 New API 官方 ui/sidebar 体系，默认折叠为图标栏（defaultOpen={false}）
 * - 移动端侧栏为 off-canvas 抽屉，由顶栏折叠按钮唤出；搜索框窄屏隐藏
 * 作用范围仅画廊列表页与详情页，全站其它公开页不受影响。
 */
export function GalleryLayout(props: GalleryLayoutProps) {
  const { children } = props
  return (
    <SidebarProvider
      defaultOpen={false}
      style={
        {
          '--sidebar-width': '200px',
          '--sidebar-width-icon': '4rem',
          '--app-header-height': '3.5rem',
          // 侧栏与顶栏同色（浅色=#FFFFFF）；走 var(--background)，深色主题自动跟随
          '--sidebar': 'var(--background)',
        } as CSSProperties
      }
    >
      <GalleryTopBar />
      <GallerySidebar />
      <SidebarInset className='pt-14'>
        {children}
      </SidebarInset>
    </SidebarProvider>
  )
}
