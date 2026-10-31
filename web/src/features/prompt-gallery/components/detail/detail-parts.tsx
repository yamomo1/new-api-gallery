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
        'overflow-hidden rounded-lg bg-[#F2F5F9] dark:bg-muted',
        className
      )}
    >
      <div className='flex items-center justify-between gap-2 border-b border-white px-3 pt-2.5 pb-2 dark:border-border/40'>
        <h3 className='text-[15px] font-semibold text-foreground/90'>{title}</h3>
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
    <div className='flex border-b border-white last:border-b-0 dark:border-border/40'>
      <div className='w-[96px] shrink-0 border-r border-white px-3 py-2 text-[13px] leading-relaxed text-muted-foreground dark:border-border/40'>
        {label}
      </div>
      <div className='min-w-0 flex-1 px-3 py-2 text-[13px] leading-relaxed break-words text-foreground/85'>
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
        'inline-flex h-[29px] items-center rounded-full px-3 text-[12px] leading-none',
        tone === 'primary'
          ? 'bg-[#FFF2D6] text-[#E49026] dark:bg-primary/15 dark:text-primary'
          : 'bg-[#F4F5F9] text-[#666] dark:bg-muted dark:text-muted-foreground'
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
    <div className='flex items-stretch gap-2'>
      <button
        type='button'
        onClick={onToggleFavorite}
        className={cn(
          'flex h-12 flex-1 items-center justify-center gap-1.5 rounded-lg text-[15px] font-medium transition-colors',
          favorited
            ? 'bg-[#FFF2D6] text-[#E49026] dark:bg-primary/15 dark:text-primary'
            : 'bg-white text-[#222] ring-1 ring-black/[0.04] hover:bg-white/85 dark:bg-card dark:text-foreground dark:ring-0'
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
          className='flex h-12 flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#FED578] text-[15px] font-medium text-[#8A4200] transition-opacity hover:opacity-90 disabled:opacity-50'
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
