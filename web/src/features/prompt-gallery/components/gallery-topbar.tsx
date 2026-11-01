import { useNavigate } from '@tanstack/react-router'
import { Search } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { LanguageSwitcher } from '@/components/language-switcher'
import { NotificationPopover } from '@/components/notification-popover'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { openSignInDialog } from '@/features/auth/sign-in-dialog'
import { useNotifications } from '@/hooks/use-notifications'
import { useSystemConfig } from '@/hooks/use-system-config'
import { useAuthStore } from '@/stores/auth-store'

/**
 * 画廊/详情类页面顶栏（白底无边框，遵循 DESIGN-SYSTEM-YMM + 用户指定例外）：
 * - 高 56px，#FFFFFF 底（var(--background)），无边框
 * - 中：胶囊搜索栏（用户明确指定的 liblib 格式：左放大镜 + 右白色圆形搜索按钮，Enter 跳搜索）
 * - 右：消息通知 / 切换风格(主题) / 切换语言 / 登录注册（或用户菜单）
 * 折叠/展开行为走 New API 官方 ui/sidebar 的 SidebarProvider；品牌区在侧栏头部。
 */
export function GalleryTopBar() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { auth } = useAuthStore()
  const { loading } = useSystemConfig()
  const notifications = useNotifications()
  const [query, setQuery] = useState('')

  const isAuthenticated = !!auth.user

  useEffect(() => {
    // 路由切换时清空输入，避免残留
    return () => setQuery('')
  }, [])

  const submitSearch = (event: FormEvent) => {
    event.preventDefault()
    const q = query.trim()
    if (!q) return
    void navigate({ to: '/prompt-gallery', search: { search: q } })
  }

  return (
    <header className='dark:bg-background fixed inset-x-0 top-0 z-50 flex h-14 items-center gap-3 bg-white px-3 md:px-4'>
      {/* 中：胶囊搜索栏（左放大镜 + 右白色圆形搜索按钮） */}
      <form
        onSubmit={submitSearch}
        className='bg-muted/70 relative mx-auto hidden h-11 w-full max-w-[700px] items-center gap-2 rounded-full py-1 pl-4 pr-1.5 md:flex'
        role='search'
      >
        <Search className='text-muted-foreground/70 pointer-events-none size-4 shrink-0' />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('Search models / AI apps / workflows / creators / images', {
            defaultValue: '搜索模型/AI应用/工作流/创作者/图片',
          })}
          className='border-transparent h-full flex-1 rounded-full bg-transparent px-1 text-sm shadow-none ring-offset-0 focus-visible:ring-0'
        />
        <Button
          type='submit'
          size='icon'
          className='bg-background hover:bg-card-2 size-8 shrink-0 rounded-full shadow-sm'
          aria-label={t('Search')}
        >
          <Search className='size-4' />
        </Button>
      </form>

      {/* 右：消息 / 切换风格 / 切换语言 / 登录态 */}
      <div className='ml-auto flex shrink-0 items-center gap-1.5'>
        <NotificationPopover
          open={notifications.popoverOpen}
          onOpenChange={notifications.setPopoverOpen}
          unreadCount={notifications.unreadCount}
          activeTab={notifications.activeTab}
          onTabChange={notifications.setActiveTab}
          notice={notifications.notice}
          announcements={notifications.announcements}
          loading={notifications.loading}
        />
        <ThemeSwitch />
        <LanguageSwitcher />
        {loading ? (
          <Skeleton className='ml-1 h-8 w-24 rounded-[10px]' />
        ) : isAuthenticated ? (
          <ProfileDropdown />
        ) : (
          <Button
            size='sm'
            className='ml-1 h-8 rounded-[10px] px-4 text-sm font-medium'
            onClick={openSignInDialog}
          >
            {t('Sign in / Sign up', { defaultValue: '登录/注册' })}
          </Button>
        )}
      </div>
    </header>
  )
}
