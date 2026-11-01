import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { ChevronDown } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar'
import { openSignInDialog } from '@/features/auth/sign-in-dialog'
import { HeaderLogo } from '@/components/layout/components/header-logo'
import { useNavConfig } from '@/hooks/use-nav-config'
import { useSystemConfig } from '@/hooks/use-system-config'
import { useAuthStore } from '@/stores/auth-store'
import type { ResolvedSidebarLink } from '@/lib/nav-config'
import { cn } from '@/lib/utils'

/**
 * 菜单项规格（liblib.art 侧栏像素实测，1x）：
 * 项高 36px、圆角 8px、左右内边距 12px、图标 20px、图标与文字间距 10px、
 * 文字 15px；激活底色 foreground 10%（≈#E7E7E9）；项节距 48px。
 * 收起态为 40×40 方块、文字不渲染。
 */
const NAV_ITEM_CLASS = [
  'h-9 gap-2.5 rounded-[8px] px-3 text-[15px] font-normal',
  '[&_svg]:size-5 text-foreground',
  'hover:bg-foreground/5 hover:text-foreground',
  'data-active:bg-foreground/10 data-active:font-semibold data-active:text-foreground',
  'data-active:hover:bg-foreground/10',
  'group-data-[collapsible=icon]:h-10! group-data-[collapsible=icon]:w-10! group-data-[collapsible=icon]:p-0!',
  'group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:[&>span]:hidden',
].join(' ')

/** 二级菜单项：字 15px，左侧有竖向引导线（对齐 liblib） */
const SUB_ITEM_CLASS = [
  'h-8 rounded-[8px] px-3 text-[15px] font-normal text-muted-foreground',
  'hover:bg-foreground/5 hover:text-foreground',
  'data-active:bg-foreground/10 data-active:font-semibold data-active:text-foreground',
  'group-data-[collapsible=icon]:hidden',
].join(' ')

/**
 * 侧栏头部品牌区：
 * - 展开态：LOGO + 站名靠左，折叠按钮靠右（一行）
 * - 收起态：LOGO 放大（32px）居中；悬浮该区域时 LOGO 隐藏、只显示展开按钮
 */
function SidebarBrand() {
  const { state, isMobile } = useSidebar()
  const { systemName, logo: systemLogo, logoLoaded } = useSystemConfig()
  const collapsed = state === 'collapsed' && !isMobile

  if (collapsed) {
    return (
      <div className='group/hdr flex h-10 items-center justify-center px-1'>
        <Link
          to='/'
          className='flex size-8 shrink-0 items-center justify-center group-hover/hdr:hidden'
          aria-label={systemName}
        >
          <HeaderLogo
            src={systemLogo}
            loading={false}
            logoLoaded={logoLoaded}
            className='size-8 rounded-lg object-contain transition-transform duration-300 hover:scale-105'
          />
        </Link>
        <SidebarTrigger className='text-muted-foreground hover:text-foreground hidden size-7 group-hover/hdr:flex' />
      </div>
    )
  }

  return (
    <div className='flex h-10 items-center justify-between gap-2'>
      <Link to='/' className='group flex min-w-0 items-center gap-2'>
        <HeaderLogo
          src={systemLogo}
          loading={false}
          logoLoaded={logoLoaded}
          className='size-[26px] shrink-0 rounded-lg object-contain transition-transform duration-300 group-hover:scale-105'
        />
        <span className='max-w-40 truncate text-[17px] font-semibold tracking-tight text-foreground'>
          {systemName}
        </span>
      </Link>
      <SidebarTrigger className='text-muted-foreground hover:text-foreground [&_svg]:size-[18px] shrink-0' />
    </div>
  )
}

/**
 * 画廊/详情类页面左侧导航栏（对齐 liblib.art）：
 * - 宽 200px、浅色纯白、无边框；菜单结构由后台「导航链接」配置驱动
 * - 支持一级菜单可展开（如「创作 → 图片生成/视频生成…」）
 * - 未配置地址的项渲染为占位（点击不跳转）；后台关闭的项不渲染
 */
export function GallerySidebar() {
  const navigate = useNavigate()
  const pathname = useRouterState().location.pathname
  const { auth } = useAuthStore()
  const isAuthenticated = !!auth.user
  const { sidebar } = useNavConfig()
  const { primary, secondary } = sidebar
  const { state, isMobile, toggleSidebar } = useSidebar()
  const iconMode = state === 'collapsed' && !isMobile
  // 记录被手动折叠的分组；默认全部展开（与 liblib 一致）
  const [closedGroups, setClosedGroups] = useState<Record<string, boolean>>({})

  // 收起态悬停父项 → 右侧浮出二级菜单（固定定位 + portal，避免被侧栏 overflow 裁掉）
  type FlyoutState = {
    id: string
    label: string
    items: ResolvedSidebarLink[]
    top: number
    left: number
  } | null
  const [flyout, setFlyout] = useState<FlyoutState>(null)
  const flyoutTimer = useRef<number | undefined>(undefined)

  const openFlyout = (link: ResolvedSidebarLink, el: HTMLElement) => {
    if (!iconMode || !link.children?.length) return
    window.clearTimeout(flyoutTimer.current)
    const rect = el.getBoundingClientRect()
    // 以侧栏右沿为基准，收起栏很窄时也能保持一个稳定的间距
    const rail = document
      .querySelector('[data-sidebar="sidebar"]')
      ?.getBoundingClientRect()
    setFlyout({
      id: link.id,
      label: link.title,
      items: link.children,
      top: rect.top - 6,
      left: (rail?.right ?? rect.right) + 10,
    })
  }
  const scheduleFlyoutClose = () => {
    window.clearTimeout(flyoutTimer.current)
    flyoutTimer.current = window.setTimeout(() => setFlyout(null), 160)
  }
  const keepFlyout = () => window.clearTimeout(flyoutTimer.current)

  // 路由切换 / 滚动 / 缩放时收起（fixed 定位会错位）
  useEffect(() => {
    if (!flyout) return
    const close = () => setFlyout(null)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
      window.removeEventListener('keydown', onKey)
    }
  }, [flyout])

  useEffect(() => {
    setFlyout(null)
  }, [pathname])

  const isActiveHref = (href: string) => {
    if (!href) return false
    return pathname === href || (href !== '/' && pathname.startsWith(href))
  }

  const handleNavigate = (link: ResolvedSidebarLink) => {
    if (!link.href) return
    if (link.requiresAuth && !isAuthenticated) {
      openSignInDialog()
      return
    }
    navigate({ to: link.href })
  }

  const renderChildren = (link: ResolvedSidebarLink) => {
    if (!link.children?.length || closedGroups[link.id] || iconMode) return null
    return (
      <ul className='border-border/70 mt-1 ml-[18px] flex flex-col gap-0.5 border-l pl-3'>
        {link.children.map((child) => {
          const active = isActiveHref(child.href)
          if (!child.href) {
            return (
              <li key={child.id}>
                <div
                  className='text-muted-foreground/70 flex h-8 cursor-default items-center rounded-[8px] px-3 text-[15px]'
                  aria-disabled
                >
                  {child.title}
                </div>
              </li>
            )
          }
          return (
            <li key={child.id}>
              <SidebarMenuButton
                isActive={active}
                className={SUB_ITEM_CLASS}
                render={
                  child.external ? (
                    <a href={child.href} target='_blank' rel='noopener noreferrer' />
                  ) : (
                    <Link to={child.href} />
                  )
                }
              >
                <span className='min-w-0 flex-1 truncate'>{child.title}</span>
              </SidebarMenuButton>
            </li>
          )
        })}
      </ul>
    )
  }

  const renderNavItem = (link: ResolvedSidebarLink) => {
    const hasChildren = !!link.children?.length
    const active = isActiveHref(link.href) || (hasChildren && link.children!.some((c) => isActiveHref(c.href)))
    const Icon = link.icon
    const label = link.title

    // 可展开分组
    if (hasChildren) {
      const open = !closedGroups[link.id]
      return (
        <SidebarMenuItem
          key={link.id}
          onMouseEnter={(e) => openFlyout(link, e.currentTarget)}
          onMouseLeave={scheduleFlyoutClose}
        >
          <SidebarMenuButton
            isActive={false}
            /* 收起态用二级浮层代替 tooltip，避免两个层叠 */
            tooltip={iconMode ? undefined : label}
            className={NAV_ITEM_CLASS}
            onClick={() => {
              if (iconMode) {
                toggleSidebar()
                return
              }
              setClosedGroups((prev) => ({ ...prev, [link.id]: open }))
            }}
          >
            {Icon ? <Icon className='shrink-0' /> : null}
            <span className='min-w-0 flex-1 truncate'>{label}</span>
            <ChevronDown
              className={`text-muted-foreground size-4 shrink-0 transition-transform duration-200 ${
                open ? 'rotate-0' : '-rotate-90'
              } group-data-[collapsible=icon]:hidden`}
            />
          </SidebarMenuButton>
          {renderChildren(link)}
        </SidebarMenuItem>
      )
    }

    // 占位项（页面未开发）：不跳转
    if (!link.href) {
      return (
        <SidebarMenuItem key={link.id}>
          <SidebarMenuButton
            isActive={active}
            tooltip={label}
            className={NAV_ITEM_CLASS}
          >
            {Icon ? <Icon className='shrink-0' /> : null}
            <span className='min-w-0 flex-1 truncate'>{label}</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      )
    }

    if (link.external) {
      return (
        <SidebarMenuItem key={link.id}>
          <SidebarMenuButton
            isActive={active}
            tooltip={label}
            className={NAV_ITEM_CLASS}
            render={<a href={link.href} target='_blank' rel='noopener noreferrer' />}
          >
            {Icon ? <Icon className='shrink-0' /> : null}
            <span className='min-w-0 flex-1 truncate'>{label}</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      )
    }

    return (
      <SidebarMenuItem key={link.id}>
        <SidebarMenuButton
          isActive={active}
          tooltip={label}
          className={NAV_ITEM_CLASS}
          onClick={() => handleNavigate(link)}
        >
          {Icon ? <Icon className='shrink-0' /> : null}
          <span className='min-w-0 flex-1 truncate'>{label}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    )
  }

  const hasSecondary = useMemo(() => secondary.length > 0, [secondary])

  return (
    <Sidebar
      collapsible='icon'
      variant='sidebar'
      /* 无框分层：去掉 ui/sidebar 内置分割线；浅色固定 #FFFFFF，深色跟随主题 */
      className='group-data-[side=left]:border-r-0 group-data-[side=right]:border-l-0 [&_[data-sidebar=sidebar]]:bg-white dark:[&_[data-sidebar=sidebar]]:bg-background'
    >
      <SidebarHeader className='px-3.5 pb-0 pt-2.5'>
        <SidebarBrand />
      </SidebarHeader>
      <SidebarContent className='px-0 pb-4 pt-6'>
        <SidebarGroup className='px-3 py-0'>
          <SidebarGroupContent>
            <SidebarMenu className='gap-3'>
              {primary.map(renderNavItem)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {hasSecondary && primary.length > 0 && (
          <>
            <SidebarSeparator className='mx-3 my-3' />
            <SidebarGroup className='px-3 py-0'>
              <SidebarGroupContent>
                <SidebarMenu className='gap-3'>
                  {secondary.map(renderNavItem)}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>

      {/* 收起态：悬停父项右侧浮出二级菜单（记忆规范 .ymm-glass-menu + .ymm-dd-item） */}
      {flyout &&
        createPortal(
          <div
            className='fixed z-[70] w-[204px]'
            style={{
              top: Math.max(
                12,
                Math.min(
                  flyout.top,
                  window.innerHeight - (56 + flyout.items.length * 36) - 12
                )
              ),
              left: flyout.left,
            }}
            onMouseEnter={keepFlyout}
            onMouseLeave={scheduleFlyoutClose}
          >
            <div className='ymm-glass-menu py-1.5'>
              <p className='text-muted-foreground px-3 pt-1.5 pb-2 text-[12px] font-medium tracking-wide'>
                {flyout.label}
              </p>
              {flyout.items.map((child) => {
                if (!child.href) {
                  return (
                    <div
                      key={child.id}
                      className='text-muted-foreground/60 cursor-default px-3 py-2 text-[13px]'
                      aria-disabled
                    >
                      {child.title}
                    </div>
                  )
                }
                const active = isActiveHref(child.href)
                return (
                  <button
                    key={child.id}
                    type='button'
                    onClick={() => {
                      handleNavigate(child)
                      setFlyout(null)
                    }}
                    className={cn('ymm-dd-item', active && 'selected')}
                  >
                    <span className='truncate'>{child.title}</span>
                  </button>
                )
              })}
            </div>
          </div>,
          document.body
        )}
    </Sidebar>
  )
}
