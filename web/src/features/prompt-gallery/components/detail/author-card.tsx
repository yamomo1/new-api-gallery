import {
  BadgeCheck,
  Eye,
  Heart,
  HeartHandshake,
  Images,
  Users,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { openSignInDialog } from '@/features/auth/sign-in-dialog'
import { toIntlLocale } from '@/i18n/languages'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'

import {
  useGalleryAuthor,
  useToggleGalleryAuthorFollow,
} from '../../hooks/use-prompt-gallery'

/**
 * 作者卡（详情页右栏 / 移动端标题下方）
 * ---------------------------------------------------------------
 * 版式对齐 liblib：头像 + 昵称 + 认证徽标（昵称下方）+ 关注按钮（右上）+ 一行作者统计。
 * 认证标签来自后台「用户管理 → 画廊认证」；未设置时统一显示「热心网友」。
 *
 * 统计与关注态走 /authors/:id，未登录也能看数据，点关注则引导登录。
 */
export function AuthorCard({
  authorId,
  author,
  badge,
}: {
  /** 作者用户 id（作品上的 author_id）；<=0 表示无账号，只展示名字 */
  authorId: number
  /** 作品上冗余的作者名：接口未返回时先用它，避免昵称闪空 */
  author: string
  /** 详情接口带回来的认证标签，避免首屏先闪「热心网友」 */
  badge?: string
}) {
  const { t, i18n } = useTranslation()
  const isLoggedIn = useAuthStore((state) => Boolean(state.auth.user))
  const selfId = useAuthStore((state) => state.auth.user?.id)
  const { data } = useGalleryAuthor(authorId)
  const followMutation = useToggleGalleryAuthorFollow()

  // 优先用作品上记录的作者名：与列表卡片保持一致；接口返回的名字作为兜底
  const name = author || data?.name || t('Anonymous', { defaultValue: '匿名创作者' })
  const initial = name.trim().slice(0, 1).toUpperCase()
  const rawBadge = (data?.badge ?? badge ?? '').trim()
  const following = Boolean(data?.following)
  // 自己的作品不显示关注
  const showFollow = authorId > 0 && selfId !== authorId
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const compact = new Intl.NumberFormat(locale, {
    notation: 'compact',
    maximumFractionDigits: 1,
  })

  const handleFollow = () => {
    if (!isLoggedIn) {
      toast(t('Sign in to follow this creator', { defaultValue: '登录后即可关注作者' }))
      // 弹窗式登录：不离开当前作品页
      openSignInDialog()
      return
    }
    followMutation.mutate(authorId)
  }

  return (
    <div className='rounded-lg bg-[#F2F5F9] p-3.5 dark:bg-muted'>
      <div className='flex items-start gap-2.5'>
        <div className='flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-[13px] font-medium text-foreground/70'>
          {initial || '?'}
        </div>

        <div className='min-w-0 flex-1'>
          <div className='flex items-start justify-between gap-2'>
            <p className='truncate text-[16px] leading-6 font-semibold text-foreground'>
              {name}
            </p>
            {showFollow && (
              <button
                type='button'
                onClick={handleFollow}
                disabled={followMutation.isPending}
                className={cn(
                  'h-6 shrink-0 rounded px-2 text-[11px] font-medium transition-colors disabled:opacity-60',
                  following
                    ? 'bg-muted text-muted-foreground hover:text-foreground'
                    : 'bg-[#1F6DFF]/10 text-[#1F6DFF] hover:bg-[#1F6DFF]/15'
                )}
              >
                {following
                  ? t('Following', { defaultValue: '已关注' })
                  : t('Follow', { defaultValue: '关注' })}
              </button>
            )}
          </div>

          {/* 认证徽标：有标签用主色，未认证回退「热心网友」用中性色 */}
          <div
            className={cn(
              'mt-1 inline-flex items-center gap-1 rounded-md px-2 py-[3px] text-[11.5px] leading-none',
              rawBadge
                ? 'bg-[#1F6DFF]/10 text-[#1F6DFF]'
                : 'bg-black/[0.04] text-muted-foreground dark:bg-muted'
            )}
          >
            {rawBadge ? (
              <BadgeCheck className='size-3.5' />
            ) : (
              <HeartHandshake className='size-3.5' />
            )}
            {rawBadge || t('Community member', { defaultValue: '热心网友' })}
          </div>
        </div>
      </div>

      {/* 作者统计：粉丝 / 作品 / 浏览 / 点赞（加载中占位保持高度不跳） */}
      {/* 数字用参考站的金棕色，图标保持中性灰 */}
      <div className='mt-2.5 flex min-h-[20px] flex-wrap items-center gap-x-3.5 gap-y-1 border-t border-white pt-2 dark:border-border/40 text-[11.5px] text-[#B07A16] [&_svg]:text-muted-foreground dark:text-primary/90'>
        {data ? (
          <>
            <span className='inline-flex items-center gap-1'>
              <Users className='size-3.5' />
              {compact.format(data.followers)}
            </span>
            <span className='inline-flex items-center gap-1'>
              <Images className='size-3.5' />
              {compact.format(data.works)}
            </span>
            <span className='inline-flex items-center gap-1'>
              <Eye className='size-3.5' />
              {compact.format(data.views)}
            </span>
            <span className='inline-flex items-center gap-1'>
              <Heart className='size-3.5' />
              {compact.format(data.likes)}
            </span>
          </>
        ) : (
          <span className='text-muted-foreground/50'>—</span>
        )}
      </div>
    </div>
  )
}
