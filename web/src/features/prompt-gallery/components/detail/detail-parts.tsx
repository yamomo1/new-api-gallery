import { Eye, Heart, Star, UserRound } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

/**
 * 详情页原子组件（/prompt-gallery/:id 与列表页弹窗共用）
 * ---------------------------------------------------------------
 * 视觉参考 liblib 的模型详情页：左栏内容（标题/媒体/提示词），
 * 右栏窄信息栏（作者 → 操作 → 版本详情 → 使用参数 → 使用说明）。
 * 颜色全部走主题 token，深色/浅色两套主题都能用。
 */

/**
 * 右栏的一张信息卡：标题栏 + 表格体。
 * 标题栏与表格、每行之间、标签列与值列之间都画分隔线（对齐 liblib 的参数表）。
 */
export function MetaSection({
  title,
  action,
  children,
  className,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        'overflow-hidden rounded-xl border border-border/60 bg-card',
        className
      )}
    >
      <div className='flex items-center justify-between gap-2 border-b border-border/60 px-3.5 py-2.5'>
        <h3 className='text-[13px] font-medium text-foreground/90'>{title}</h3>
        {action}
      </div>
      <div>{children}</div>
    </section>
  )
}

/**
 * 表格行：左标签列（右侧竖线）+ 右值列（左对齐，长文本自动换行），
 * 行与行之间横线，最后一行不画（交给卡片边框）。
 */
export function KeyValueRow({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className='flex border-b border-border/50 last:border-b-0'>
      <div className='w-[84px] shrink-0 border-r border-border/50 px-3.5 py-2 text-[12.5px] leading-relaxed text-muted-foreground'>
        {label}
      </div>
      <div className='min-w-0 flex-1 px-3.5 py-2 text-[12.5px] leading-relaxed break-words text-foreground/85'>
        {children}
      </div>
    </div>
  )
}

/** 小号标签 chip（模型 / 类型 / 分类），primary 变体用于强调模型 */
export function MetaChip({
  children,
  tone = 'default',
}: {
  children: ReactNode
  tone?: 'default' | 'primary'
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-[3px] text-[11.5px] leading-none',
        tone === 'primary'
          ? 'bg-primary/12 text-primary'
          : 'bg-muted text-muted-foreground'
      )}
    >
      {children}
    </span>
  )
}

/** 作者卡：头像（首字母）+ 名字 + 数据 */
export function AuthorCard({
  author,
  views,
  likes,
  createdAt,
}: {
  author: string
  views: number
  likes: number
  createdAt: number
}) {
  const { t } = useTranslation()
  const initial = (author || '?').trim().slice(0, 1).toUpperCase()
  const date = createdAt
    ? new Date(createdAt * 1000).toLocaleDateString('zh-CN')
    : ''

  return (
    <div className='rounded-xl border border-border/60 bg-card p-4'>
      <div className='flex items-center gap-3'>
        <div className='flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-[15px] font-medium text-foreground/70'>
          {author ? initial : <UserRound className='size-4.5' />}
        </div>
        <div className='min-w-0'>
          <div className='flex items-center gap-1.5'>
            <span className='truncate text-[14px] font-medium'>
              {author || t('Anonymous', { defaultValue: '匿名创作者' })}
            </span>
            <span className='shrink-0 rounded-[4px] bg-primary/12 px-1.5 py-[1px] text-[10px] leading-none text-primary'>
              {t('Creator', { defaultValue: '创作者' })}
            </span>
          </div>
          {date && (
            <p className='mt-1 text-[11.5px] text-muted-foreground'>
              {t('Published on', { defaultValue: '发布于' })} {date}
            </p>
          )}
        </div>
      </div>

      <div className='mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border/50 pt-2.5 text-[12px] text-muted-foreground'>
        <span className='inline-flex items-center gap-1'>
          <Eye className='size-3.5' />
          {views}
        </span>
        <span className='inline-flex items-center gap-1'>
          <Heart className='size-3.5' />
          {likes}
        </span>
      </div>
    </div>
  )
}

/** 主操作行：收藏（次）+ 去创作（主）。去创作不可用时只渲染收藏 */
export function PrimaryActions({
  favorited,
  onToggleFavorite,
  onCreate,
  createDisabled,
}: {
  favorited: boolean
  onToggleFavorite: () => void
  onCreate?: () => void
  createDisabled?: boolean
}) {
  const { t } = useTranslation()
  return (
    <div className='flex items-stretch gap-2'>
      <button
        type='button'
        onClick={onToggleFavorite}
        className={cn(
          'flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg border text-[13px] font-medium transition-colors',
          favorited
            ? 'border-primary/40 bg-primary/10 text-primary'
            : 'border-border bg-card text-foreground/80 hover:border-border hover:bg-muted'
        )}
      >
        <Star className={cn('size-4', favorited && 'fill-current')} />
        {favorited
          ? t('Favorited', { defaultValue: '已收藏' })
          : t('Favorite', { defaultValue: '收藏' })}
      </button>
      {onCreate && (
        <button
          type='button'
          onClick={onCreate}
          disabled={createDisabled}
          className='flex h-10 flex-[1.4] items-center justify-center gap-1.5 rounded-lg bg-primary text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50'
        >
          {t('Create with this', { defaultValue: '去创作' })}
        </button>
      )}
    </div>
  )
}

/** 底部免责小字（与「使用说明」卡区分：这里只说平台责任边界） */
export function DetailDisclaimer() {
  const { t } = useTranslation()
  return (
    <p className='px-1 text-[11px] leading-relaxed text-muted-foreground/70'>
      {t(
        'Content is uploaded by creators. Report to us if it infringes your rights.',
        {
          defaultValue: '内容由创作者上传，如涉侵权请联系我们处理。',
        }
      )}
    </p>
  )
}
