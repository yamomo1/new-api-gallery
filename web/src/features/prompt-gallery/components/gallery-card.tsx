import { useCallback, forwardRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Copy,
  Eye,
  Flame,
  Heart,
  Image as ImageIcon,
  Share2,
  Star,
  Video,
  Zap,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { resolveImageUrl } from '@/lib/storage'

import type { PromptGalleryItem } from '../types'
import { isVideoUrl, parseGalleryMedia } from '../utils'
import { coverHeight } from '../hooks/use-masonry'

type GalleryCardProps = {
  item: PromptGalleryItem
  /** 在列表中的序号，用于入场 stagger 延迟 */
  index?: number
  onOpen?: (item: PromptGalleryItem) => void
  liked?: boolean
  likeCount?: number
  onLike?: (item: PromptGalleryItem) => void
  favorite?: boolean
  onToggleFavorite?: (id: number) => void
  onCopy?: (prompt: string) => void
  /** 分享单个作品（复制直达链接 / 系统分享） */
  onShare?: (item: PromptGalleryItem) => void
  /** 生成同款：带着提示词跳生成工作台 */
  onGenerate?: (item: PromptGalleryItem) => void
}

/**
 * 单张瀑布流卡片（设计规范 §8.7 / §8.8）
 * ------------------------------------------------------------------
 * 结构：
 *   .cover  封面（高度按 id 稳定派生 180–300px，制造错落）
 *           └ .ctags  左上角无边框标签：图标 + 白字直接压图（text-shadow 保可读）
 *   .meta   常驻信息：标题 + 一行「作者 · 👁 浏览 / ♥ 收藏」
 *   .body   推挤展开面板：默认 0fr 完全收起（含按钮），hover/focus-within 撑开到 1fr
 *
 * 刻意**没有**卡片边框、没有底部黑色渐变遮罩 —— 规范要求图片本身即卡片。
 */
export const GalleryCard = forwardRef<HTMLElement, GalleryCardProps>(function GalleryCard(
  {
    item,
    index = 0,
    onOpen,
    liked,
    likeCount,
    onLike,
    favorite,
    onToggleFavorite,
    onCopy,
    onShare,
    onGenerate,
  },
  ref
) {
  const { t } = useTranslation()
  const media = parseGalleryMedia(item)
  const cover = resolveImageUrl(item.cover) || media[0]

  const coverIsVideo = cover ? isVideoUrl(cover) : false
  const isVideoItem = item.type === 'video' || coverIsVideo
  const likes = likeCount ?? item.likes
  // 「热门」判定：点赞过百，或用琥珀色火焰标出高热度作品
  const isHot = likes >= 100

  const stop = (e: React.MouseEvent) => e.stopPropagation()

  const handleCopy = useCallback(
    (e: React.MouseEvent) => {
      stop(e)
      if (onCopy) onCopy(item.prompt)
      else navigator.clipboard?.writeText(item.prompt)
    },
    [item.prompt, onCopy]
  )

  const handleShare = (e: React.MouseEvent) => {
    stop(e)
    onShare?.(item)
  }

  const handleLike = (e: React.MouseEvent) => {
    stop(e)
    onLike?.(item)
  }

  const handleFavorite = (e: React.MouseEvent) => {
    stop(e)
    onToggleFavorite?.(item.id)
  }

  const handleGenerate = (e: React.MouseEvent) => {
    stop(e)
    onGenerate?.(item)
  }

  const open = () => onOpen?.(item)

  /** 封面渲染：视频走 <video>，图片走懒加载 <img>，无封面给占位图标 */
  const renderCover = () => {
    if (!cover) {
      return (
        <div className='flex size-full items-center justify-center text-muted-foreground'>
          {isVideoItem ? <Video className='size-8' /> : <ImageIcon className='size-8' />}
        </div>
      )
    }
    const mediaClass =
      'size-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.035]'
    if (coverIsVideo) {
      return (
        <video
          src={cover}
          muted
          loop
          playsInline
          preload='metadata'
          className={mediaClass}
        />
      )
    }
    return <img src={cover} alt={item.title} loading='lazy' className={mediaClass} />
  }

  return (
    <article
      ref={ref}
      data-masonry-item
      role='button'
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          open()
        }
      }}
      style={{ animationDelay: `${(index % 12) * 45}ms` }}
      className={cn(
        'group relative w-full cursor-pointer outline-none',
        // 入场：轻微上浮淡入，不影响布局高度
        'animate-in fade-in-0 slide-in-from-bottom-2 duration-500 fill-mode-both',
        'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'rounded-xl'
      )}
    >
      {/* ── 封面 ───────────────────────────────────────────── */}
      <div
        className='relative w-full overflow-hidden rounded-xl bg-muted transition-shadow duration-300 group-hover:shadow-[0_18px_46px_-24px_rgba(0,0,0,.55)]'
        style={{ height: coverHeight(item.id) }}
      >
        {renderCover()}

        {/* 视频中央播放键 */}
        {isVideoItem && (
          <span className='pointer-events-none absolute inset-0 flex items-center justify-center'>
            <span className='flex size-11 items-center justify-center rounded-full bg-black/40 backdrop-blur-sm transition-transform duration-200 group-hover:scale-110'>
              <Video className='size-5 text-white' />
            </span>
          </span>
        )}

        {/* 左上角标签：无边框无底色，图标 + 白字直接压图 */}
        <div className='pointer-events-none absolute left-2.5 top-2.5 flex flex-wrap items-center gap-3'>
          <span className='inline-flex items-center gap-1.5 text-xs font-semibold text-white [text-shadow:0_1px_5px_rgba(0,0,0,.75),0_0_2px_rgba(0,0,0,.5)]'>
            {isVideoItem ? (
              <Video className='size-3.5 drop-shadow-[0_1px_3px_rgba(0,0,0,.6)]' />
            ) : (
              <ImageIcon className='size-3.5 drop-shadow-[0_1px_3px_rgba(0,0,0,.6)]' />
            )}
            {isVideoItem ? t('Video') : t('Image')}
          </span>
          {isHot && (
            <span className='inline-flex items-center gap-1.5 text-xs font-semibold text-amber-300 [text-shadow:0_1px_5px_rgba(0,0,0,.75),0_0_2px_rgba(0,0,0,.5)]'>
              <Flame className='size-3.5 drop-shadow-[0_1px_3px_rgba(0,0,0,.6)]' />
              {t('Popular')}
            </span>
          )}
        </div>

        {/* 收藏按钮：仅 hover / 已收藏时出现，避免常驻遮挡画面 */}
        {onToggleFavorite && (
          <button
            type='button'
            aria-label={favorite ? t('Favorited') : t('Favorite')}
            aria-pressed={favorite}
            onClick={handleFavorite}
            className={cn(
              'absolute right-2 top-2 flex size-7 items-center justify-center rounded-lg text-white/90 backdrop-blur-sm transition-all duration-200',
              'bg-black/35 hover:bg-black/60 focus-visible:ring-2 focus-visible:ring-ring',
              favorite
                ? 'opacity-100 text-amber-300'
                : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'
            )}
          >
            <Star className={cn('size-3.5', favorite && 'fill-current')} />
          </button>
        )}
      </div>

      {/* ── 常驻信息：标题 + 「作者 · 浏览 / 收藏」一行 ────────── */}
      <div className='px-1 pb-0.5 pt-2.5'>
        <div className='min-w-0'>
          {/* 真 <a href>：SPA onClick 对不跑 JS 的爬虫等于不存在，这条内链是收录入口 */}
          <a
            href={`/prompt-gallery/${item.id}`}
            title={item.title}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              open()
            }}
            className='block truncate text-sm font-semibold leading-snug text-foreground hover:underline'
          >
            {item.title}
          </a>
        </div>

        <div className='mt-1.5 flex items-center justify-between gap-2'>
          <span className='flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground'>
            <span
              aria-hidden
              className='flex size-[18px] shrink-0 items-center justify-center rounded-full bg-primary/15 text-[9.5px] font-bold uppercase text-primary'
            >
              {(item.author || 'Y').slice(0, 1)}
            </span>
            <span className='truncate'>{item.author || '—'}</span>
          </span>

          <span className='flex shrink-0 items-center gap-2.5 text-xs tabular-nums text-muted-foreground'>
            <span className='inline-flex items-center gap-1' title={t('Views')}>
              <Eye className='size-3' />
              {item.views}
            </span>
            <span
              className={cn('inline-flex items-center gap-1', liked && 'text-rose-500')}
              title={t('Like')}
            >
              <Heart className={cn('size-3', liked && 'fill-current')} />
              {likes}
            </span>
          </span>
        </div>
      </div>

      {/* ── 推挤展开面板：默认 0fr 完全收起，hover/focus-within 撑开 1fr ── */}
      <div
        className={cn(
          'ymm-gcard-expand grid grid-rows-[0fr] opacity-0 transition-[grid-template-rows,opacity] duration-[460ms] ease-[cubic-bezier(.22,.61,.36,1)]',
          'pointer-events-none',
          // 触屏没有 hover：由 index.css 的 @media (hover:none) 降级为常驻
          'group-hover:grid-rows-[1fr] group-hover:opacity-100 group-hover:pointer-events-auto',
          'group-focus-within:grid-rows-[1fr] group-focus-within:opacity-100 group-focus-within:pointer-events-auto'
        )}
      >
        <div className='min-h-0 overflow-hidden'>
          <div className='ymm-gcard-expand-inner mt-2.5 translate-y-[-12px] transition-transform duration-[460ms] ease-[cubic-bezier(.22,.61,.36,1)] group-hover:translate-y-0 group-focus-within:translate-y-0'>
            <div className='flex items-center gap-2'>
              <button
                type='button'
                onClick={handleGenerate}
                className='inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary text-[13px] font-semibold text-primary-foreground transition-[filter,transform,box-shadow] duration-200 hover:brightness-105 hover:-translate-y-px active:translate-y-0'
              >
                <Zap className='size-3.5 fill-current' />
                {t('Generate alike')}
              </button>
              <button
                type='button'
                aria-label={t('Copy Prompt')}
                title={t('Copy Prompt')}
                onClick={handleCopy}
                className='flex size-8 items-center justify-center rounded-lg border border-border bg-muted/60 text-foreground transition-colors hover:border-foreground/25 hover:text-primary'
              >
                <Copy className='size-3.5' />
              </button>
              <button
                type='button'
                aria-label={t('Like')}
                title={t('Like')}
                disabled={liked}
                onClick={handleLike}
                className={cn(
                  'flex size-8 items-center justify-center rounded-lg border border-border bg-muted/60 text-foreground transition-colors hover:border-foreground/25',
                  liked ? 'text-rose-500' : 'hover:text-rose-500',
                  !onLike && 'hidden'
                )}
              >
                <Heart className={cn('size-3.5', liked && 'fill-current')} />
              </button>
              <button
                type='button'
                aria-label={t('Share work')}
                title={t('Share work')}
                onClick={handleShare}
                className='flex size-8 items-center justify-center rounded-lg border border-border bg-muted/60 text-foreground transition-colors hover:border-foreground/25 hover:text-primary'
              >
                <Share2 className='size-3.5' />
              </button>
            </div>
          </div>
        </div>
      </div>
    </article>
  )
})

/** 骨架屏：高度与真实卡片接近，避免加载完成时跳动 */
export function GalleryCardSkeleton({ index = 0 }: { index?: number }) {
  const h = coverHeight(index * 7 + 3)
  return (
    <div className='w-full animate-pulse'>
      <div className='w-full rounded-xl bg-muted' style={{ height: h }} />
      <div className='space-y-2 px-1 pt-2.5'>
        <div className='h-3.5 w-2/3 rounded bg-muted' />
        <div className='h-3 w-1/3 rounded bg-muted' />
      </div>
    </div>
  )
}
