import { Play, Star } from 'lucide-react'
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
        'inline-flex items-center rounded-lg px-2.5 py-1 text-[12.5px] leading-none',
        tone === 'primary'
          ? 'bg-primary/12 text-primary'
          : 'bg-muted text-muted-foreground'
      )}
    >
      {children}
    </span>
  )
}

/** 主操作行：收藏（次）+ 去创作（主），两个按钮等宽等高（对齐参考稿） */
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
    <div className='flex items-stretch gap-2.5'>
      <button
        type='button'
        onClick={onToggleFavorite}
        className={cn(
          'flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border text-[14px] font-medium transition-colors',
          favorited
            ? 'border-primary/40 bg-primary/10 text-primary'
            : 'border-border bg-card text-foreground/80 hover:border-border hover:bg-muted'
        )}
      >
        <Star className={cn('size-4.5', favorited && 'fill-current')} />
        {favorited
          ? t('Favorited', { defaultValue: '已收藏' })
          : t('Favorite', { defaultValue: '收藏' })}
      </button>
      {onCreate && (
        <button
          type='button'
          onClick={onCreate}
          disabled={createDisabled}
          className='flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-primary text-[14px] font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50'
        >
          <Play className='size-4 fill-current' />
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
