import { useTranslation } from 'react-i18next'
import { Copy, Eye, Heart, Play, Share2, Star, Video } from 'lucide-react'

import { cn } from '@/lib/utils'

import type { PromptGalleryItem } from '../types'
import { isVideoUrl, parseGalleryMedia } from '../utils'

type GalleryCardProps = {
  item: PromptGalleryItem
  onOpen?: (item: PromptGalleryItem) => void
  liked?: boolean
  likeCount?: number
  onLike?: (item: PromptGalleryItem) => void
  favorite?: boolean
  onToggleFavorite?: (id: number) => void
  onCopy?: (prompt: string) => void
  /** 分享单个作品（复制直达链接 / 系统分享） */
  onShare?: (item: PromptGalleryItem) => void
}

/** 单张画廊卡片（对标参考站）：封面 + 视频播放键 + 浏览量 + 底部浮层（标题/复制/点赞/收藏） */
export function GalleryCard({
  item,
  onOpen,
  liked,
  likeCount,
  onLike,
  favorite,
  onToggleFavorite,
  onCopy,
  onShare,
}: GalleryCardProps) {
  const { t } = useTranslation()
  const media = parseGalleryMedia(item)
  const cover = item.cover || media[0]

  // 视频类型：若封面本身就是视频文件则直接可播，否则用封面图 + 播放键
  const coverIsVideo = cover ? isVideoUrl(cover) : false
  const isVideoItem = item.type === 'video' || coverIsVideo

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onCopy) {
      onCopy(item.prompt)
      return
    }
    navigator.clipboard?.writeText(item.prompt)
  }

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation()
    onLike?.(item)
  }

  const handleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation()
    onToggleFavorite?.(item.id)
  }

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation()
    onShare?.(item)
  }

  return (
    <figure
      role='button'
      tabIndex={0}
      onClick={() => onOpen?.(item)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onOpen?.(item)
      }}
      className='group relative mb-6 cursor-pointer break-inside-avoid overflow-hidden rounded-2xl border border-border bg-card outline-none transition-shadow hover:shadow-xl focus-visible:ring-2 focus-visible:ring-ring'
    >
      <div className='relative w-full overflow-hidden bg-muted'>
        {cover ? (
          coverIsVideo ? (
            <video
              src={cover}
              muted
              loop
              playsInline
              preload='metadata'
              className='block w-full'
            />
          ) : (
            <img
              src={cover}
              alt={item.title}
              loading='lazy'
              className='block w-full transition-transform duration-300 group-hover:scale-[1.03]'
            />
          )
        ) : (
          <div className='flex aspect-[4/3] w-full items-center justify-center text-muted-foreground'>
            <Video className='size-8' />
          </div>
        )}

        {/* 视频中央播放键 */}
        {isVideoItem && (
          <span className='pointer-events-none absolute inset-0 flex items-center justify-center'>
            <span className='flex size-11 items-center justify-center rounded-full bg-black/45 backdrop-blur-sm transition-transform duration-200 group-hover:scale-110'>
              <Play className='size-5 fill-white text-white' />
            </span>
          </span>
        )}

        {/* 右上角浏览量 */}
        <span className='absolute right-2 top-2 inline-flex items-center gap-1 rounded-md bg-black/50 px-1.5 py-0.5 text-[11px] font-medium text-white/90 backdrop-blur-sm'>
          <Eye className='size-3' /> {item.views}
        </span>

        {/* 收藏角标 */}
        {onToggleFavorite && (
          <button
            type='button'
            aria-label={favorite ? t('Favorited') : t('Favorite')}
            onClick={handleFavorite}
            className={cn(
              'absolute left-2 top-2 flex size-7 items-center justify-center rounded-full bg-black/50 text-white/80 backdrop-blur-sm transition-colors hover:bg-black/70',
              favorite && 'text-amber-400'
            )}
          >
            <Star className={cn('size-3.5', favorite && 'fill-current')} />
          </button>
        )}
      </div>

      {/* 底部渐变浮层：标题 + 复制 + 点赞 */}
      <div className='absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent p-3 pt-8'>
        <div className='flex items-end justify-between gap-2'>
          <div className='min-w-0'>
            <p className='truncate text-sm font-semibold text-white'>
              {item.title}
            </p>
            {item.model && (
              <p className='mt-0.5 truncate text-[11px] text-white/65'>
                {item.model}
              </p>
            )}
          </div>
          <div className='flex shrink-0 items-center gap-1'>
            <button
              type='button'
              aria-label={t('Copy Prompt')}
              title={t('Copy Prompt')}
              onClick={handleCopy}
              className='flex size-7 items-center justify-center rounded-full bg-white/10 text-white/80 transition-colors hover:bg-white/25 hover:text-white'
            >
              <Copy className='size-3.5' />
            </button>
            <button
              type='button'
              aria-label={t('Share work')}
              title={t('Share work')}
              onClick={handleShare}
              className='flex size-7 items-center justify-center rounded-full bg-white/10 text-white/80 transition-colors hover:bg-white/25 hover:text-white'
            >
              <Share2 className='size-3.5' />
            </button>
            <button
              type='button'
              aria-label={liked ? t('Favorited') : 'Like'}
              title='Like'
              disabled={liked}
              onClick={handleLike}
              className={cn(
                'flex h-7 items-center gap-1 rounded-full bg-white/10 px-2 text-[11px] font-medium text-white/80 transition-colors hover:bg-white/25 hover:text-white',
                liked && 'text-rose-400 hover:bg-white/10',
                !onLike && 'pointer-events-none opacity-80'
              )}
            >
              <Heart className={cn('size-3.5', liked && 'fill-current')} />
              {likeCount ?? item.likes}
            </button>
          </div>
        </div>
      </div>

      {/* hover 显示提示词预览 */}
      <div className='pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/70 to-transparent p-3 opacity-0 transition-opacity duration-200 group-hover:opacity-100'>
        <p className='line-clamp-3 text-xs leading-relaxed text-white/90'>
          {item.prompt}
        </p>
      </div>
    </figure>
  )
}

export function GalleryCardSkeleton() {
  return (
    <div className='mb-6 break-inside-avoid overflow-hidden rounded-2xl border border-border bg-card'>
      <div className='aspect-[4/3] w-full animate-pulse bg-muted' />
      <div className='space-y-2 px-3 py-2'>
        <div className='h-3.5 w-2/3 animate-pulse rounded bg-muted' />
        <div className='h-3 w-1/3 animate-pulse rounded bg-muted' />
      </div>
    </div>
  )
}
