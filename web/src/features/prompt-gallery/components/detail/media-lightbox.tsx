import {
  BadgeCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Heart,
  MessageSquare,
  Wand2,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { cn } from '@/lib/utils'

import type { PromptGalleryItem } from '../../types'
import { copyText, formatPublishDate, isVideoUrl, parseGalleryTags } from '../../utils'

/**
 * 大图查看器（点击详情页图片打开）
 * ---------------------------------------------------------------
 * 版式对齐 liblib 的图片查看器：黑色底 + 居中大图 + 右侧作品信息面板
 * （作者 → 标题 → 时间/工具 → 生成参数 → 模型信息 → 基础信息 → 评论 → 底部操作）。
 *
 * 移动端右侧面板改底部抽屉（默认收起，点「作品信息」拉起），
 * 否则窄屏上图片只剩一条缝。
 */
export function MediaLightbox({
  item,
  media,
  index,
  onIndexChange,
  onClose,
  likeCount,
  onLike,
  liked,
  onCreate,
}: {
  item: PromptGalleryItem
  media: string[]
  index: number
  onIndexChange: (next: number) => void
  onClose: () => void
  likeCount?: number
  onLike?: () => void
  liked?: boolean
  onCreate: () => void
}) {
  const { t } = useTranslation()
  const [paramsOpen, setParamsOpen] = useState(true)
  const [panelOpen, setPanelOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const tags = useMemo(() => parseGalleryTags(item.tags), [item.tags])
  const current = media[index] ?? media[0]
  const multiple = media.length > 1
  const typeLabel =
    item.type === 'video'
      ? t('Video prompt', { defaultValue: '视频提示词' })
      : t('Image prompt', { defaultValue: '图片提示词' })

  const go = useCallback(
    (direction: 1 | -1) => {
      const next = (index + direction + media.length) % media.length
      onIndexChange(next)
    },
    [index, media.length, onIndexChange]
  )

  // 锁滚动 + 键盘：Esc 关闭 / ← → 切图
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowLeft' && multiple) go(-1)
      if (event.key === 'ArrowRight' && multiple) go(1)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
    }
  }, [go, multiple, onClose])

  useEffect(() => {
    setCopied(false)
  }, [item.id, index])

  const handleCopy = async () => {
    const ok = await copyText(item.prompt)
    if (!ok) {
      toast.error(t('Copy failed'))
      return
    }
    setCopied(true)
    toast.success(t('Prompt copied'))
    setTimeout(() => setCopied(false), 1500)
  }

  const initial = (item.author || '?').trim().slice(0, 1).toUpperCase()

  // 媒体节点提前算好，避免 JSX 里叠三元
  let mediaNode: ReactNode = null
  if (current) {
    mediaNode = isVideoUrl(current) ? (
      <video
        key={current}
        src={current}
        controls
        autoPlay
        loop
        playsInline
        className='max-h-full max-w-full rounded-lg object-contain'
      />
    ) : (
      <img
        key={current}
        src={current}
        alt={item.title}
        className='max-h-full max-w-full rounded-lg object-contain'
      />
    )
  }

  const content = (
    <div
      role='dialog'
      aria-modal='true'
      aria-label={item.title}
      className='fixed inset-0 z-[130] flex flex-col bg-black lg:flex-row'
    >
      {/* ── 大图区 ── */}
      <div className='relative flex min-h-0 flex-1 items-center justify-center p-4 pb-20 lg:p-8'>
        {mediaNode}

        <button
          type='button'
          onClick={onClose}
          aria-label={t('Close')}
          className='absolute top-3 right-3 flex size-9 items-center justify-center rounded-full bg-white/12 text-white/85 backdrop-blur-sm transition-colors hover:bg-white/22 hover:text-white'
        >
          <X className='size-5' />
        </button>

        {multiple && (
          <>
            <button
              type='button'
              onClick={() => go(-1)}
              aria-label={t('Previous image')}
              className='absolute top-1/2 left-3 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/12 text-white/85 backdrop-blur-sm transition-colors hover:bg-white/22 hover:text-white'
            >
              <ChevronLeft className='size-6' />
            </button>
            <button
              type='button'
              onClick={() => go(1)}
              aria-label={t('Next image')}
              className='absolute top-1/2 right-3 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/12 text-white/85 backdrop-blur-sm transition-colors hover:bg-white/22 hover:text-white'
            >
              <ChevronRight className='size-6' />
            </button>
            <span className='absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-[12px] text-white/70'>
              {index + 1} / {media.length}
            </span>
          </>
        )}

        {/* 移动端拉起信息面板 */}
        <button
          type='button'
          onClick={() => setPanelOpen(true)}
          className='absolute right-3 bottom-4 inline-flex h-9 items-center gap-1.5 rounded-full bg-white/12 px-3.5 text-[12.5px] text-white/90 backdrop-blur-sm lg:hidden'
        >
          <MessageSquare className='size-4' />
          {t('Work info', { defaultValue: '作品信息' })}
        </button>
      </div>

      {/* ── 信息面板 ── */}
      <aside
        className={cn(
          'z-10 flex w-full shrink-0 flex-col bg-background',
          'absolute inset-x-0 bottom-0 max-h-[74%] rounded-t-2xl transition-transform duration-300 ease-out',
          'lg:static lg:h-auto lg:max-h-none lg:w-[380px] lg:rounded-none lg:border-l lg:border-border lg:transition-none',
          panelOpen ? 'translate-y-0' : 'translate-y-full lg:translate-y-0'
        )}
      >
        <div className='flex items-center justify-between border-b border-border/60 px-5 py-3 lg:hidden'>
          <span className='text-[14px] font-medium'>
            {t('Work info', { defaultValue: '作品信息' })}
          </span>
          <button
            type='button'
            onClick={() => setPanelOpen(false)}
            aria-label={t('Close')}
            className='flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted'
          >
            <X className='size-4.5' />
          </button>
        </div>

        <div className='min-h-0 flex-1 overflow-y-auto px-5 py-4 [scrollbar-width:thin]'>
          {/* 作者 */}
          <div className='flex items-center gap-2'>
            <span className='flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-[12px] font-medium text-foreground/70'>
              {initial}
            </span>
            <span className='min-w-0 truncate text-[13px] font-medium text-foreground'>
              {item.author || t('Anonymous', { defaultValue: '匿名创作者' })}
            </span>
            {item.author_badge && (
              <span className='inline-flex shrink-0 items-center gap-0.5 rounded bg-primary/12 px-1.5 py-[2px] text-[10px] text-primary'>
                <BadgeCheck className='size-3' />
                {item.author_badge}
              </span>
            )}
            <button
              type='button'
              onClick={onLike}
              disabled={liked}
              className={cn(
                'ml-auto inline-flex shrink-0 items-center gap-1 text-[12px] transition-colors',
                liked ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Heart className={cn('size-3.5', liked && 'fill-current')} />
              {likeCount ?? item.likes}
            </button>
          </div>

          <h2 className='mt-3 text-[15px] leading-snug font-semibold text-foreground'>
            {item.title}
          </h2>
          <p className='mt-1.5 text-[11.5px] text-muted-foreground'>
            {formatPublishDate(item.created_at)}
            {' · '}
            {t('Created with', { defaultValue: '创作工具' })}：{typeLabel}
            {' · '}
            {t('Content generated by AI', { defaultValue: '内容由 AI 生成' })}
          </p>

          {/* 生成参数 */}
          <div className='mt-4 border-t border-border/60 pt-3'>
            <button
              type='button'
              onClick={() => setParamsOpen((v) => !v)}
              aria-expanded={paramsOpen}
              className='flex w-full items-center justify-between text-[13px] font-medium text-foreground'
            >
              {t('Generation parameters', { defaultValue: '生成参数' })}
              <ChevronDown
                className={cn(
                  'size-4 text-muted-foreground transition-transform',
                  paramsOpen && 'rotate-180'
                )}
              />
            </button>

            {paramsOpen && (
              <div className='mt-3 space-y-3.5'>
                <div>
                  <div className='flex items-center justify-between'>
                    <span className='text-[11.5px] text-muted-foreground'>
                      {t('Prompt text', { defaultValue: '提示词' })}
                    </span>
                    <button
                      type='button'
                      onClick={handleCopy}
                      className='inline-flex items-center gap-1 text-[11.5px] text-muted-foreground hover:text-foreground'
                    >
                      <Copy className='size-3' />
                      {copied ? t('Copied', { defaultValue: '已复制' }) : t('Copy', { defaultValue: '复制' })}
                    </button>
                  </div>
                  <p className='mt-1.5 max-h-[168px] overflow-y-auto pr-1 text-[12.5px] leading-[1.75] whitespace-pre-wrap text-foreground/85 [scrollbar-width:thin]'>
                    {item.prompt}
                  </p>
                </div>

                <div>
                  <span className='text-[11.5px] text-muted-foreground'>
                    {t('Model info', { defaultValue: '模型信息' })}
                  </span>
                  <div className='mt-1.5 flex items-center gap-2 rounded-lg border border-border/60 px-2 py-1.5'>
                    <span className='flex size-6 shrink-0 items-center justify-center rounded bg-primary/12 text-[10px] font-semibold text-primary'>
                      AI
                    </span>
                    <span className='min-w-0 flex-1 truncate text-[12.5px] text-foreground/85'>
                      {item.model || '—'}
                    </span>
                  </div>
                </div>

                <div>
                  <span className='text-[11.5px] text-muted-foreground'>
                    {t('Base info', { defaultValue: '基础信息' })}
                  </span>
                  <div className='mt-1.5 space-y-1.5 text-[12.5px]'>
                    <div className='flex items-center justify-between gap-3'>
                      <span className='text-muted-foreground'>
                        {t('Type', { defaultValue: '类型' })}
                      </span>
                      <span className='text-foreground/85'>{typeLabel}</span>
                    </div>
                    <div className='flex items-center justify-between gap-3'>
                      <span className='text-muted-foreground'>
                        {t('Language', { defaultValue: '语言' })}
                      </span>
                      <span className='text-foreground/85'>
                        {item.prompt_en?.trim()
                          ? t('Chinese & English', { defaultValue: '中英双语' })
                          : t('Chinese', { defaultValue: '中文' })}
                      </span>
                    </div>
                    {tags.length > 0 && (
                      <div className='flex flex-wrap justify-end gap-1 pt-0.5'>
                        {tags.slice(0, 6).map((tag) => (
                          <span
                            key={tag}
                            className='rounded bg-muted px-1.5 py-[2px] text-[11px] text-muted-foreground'
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 评论：尚未接入后端 —— 只放一条写明「即将上线」的占位条，不做能点但没反应的假输入框 */}
          <div className='mt-4 border-t border-border/60 pt-3'>
            <h3 className='text-[13px] font-medium text-foreground'>
              {t('Comments', { defaultValue: '评论' })}
            </h3>
            <div className='mt-2.5 flex items-center gap-2 rounded-full border border-border/60 bg-muted/40 px-3 py-2'>
              <span className='flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground'>
                {initial}
              </span>
              <span className='text-[12px] text-muted-foreground/70'>
                {t('Comments are coming soon', {
                  defaultValue: '评论功能即将上线',
                })}
              </span>
            </div>
            <div className='mt-5 flex flex-col items-center gap-2 pb-2 text-center'>
              <MessageSquare className='size-8 text-muted-foreground/30' />
              <p className='text-[12px] text-muted-foreground/70'>
                {t('No comments yet', { defaultValue: '暂无评论' })}
              </p>
            </div>
          </div>
        </div>

        {/* 底部操作 */}
        <div className='flex shrink-0 items-center gap-2 border-t border-border/60 px-5 py-3'>
          <button
            type='button'
            onClick={handleCopy}
            className='inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg border border-border text-[13px] font-medium text-foreground/85 transition-colors hover:bg-muted'
          >
            <Copy className='size-4' />
            {t('Copy prompt', { defaultValue: '复制提示词' })}
          </button>
          <button
            type='button'
            onClick={onCreate}
            className='inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#FED578] text-[13px] font-medium text-[#8A4200] transition-opacity hover:opacity-90'
          >
            <Wand2 className='size-4' />
            {t('Create the same', { defaultValue: '做同款' })}
          </button>
        </div>
      </aside>
    </div>
  )

  if (typeof document === 'undefined') return content
  return createPortal(content, document.body)
}
