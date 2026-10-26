import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Heart, Video } from 'lucide-react'

import { Button } from '@/components/ui/button'

import type { PromptGalleryItem } from '../types'

type GalleryCardProps = {
  item: PromptGalleryItem
  onCopy?: (prompt: string) => void
}

/** 单张画廊卡片：封面 + hover 提示词浮层（复制 / 模型 / 点赞） */
export function GalleryCard({ item, onCopy }: GalleryCardProps) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)

  const media: string[] = (() => {
    try {
      const parsed = JSON.parse(item.media || '[]')
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return item.cover ? [item.cover] : []
    }
  })()

  const cover = item.cover || media[0]

  const handleCopy = () => {
    if (onCopy) {
      onCopy(item.prompt)
      return
    }
    navigator.clipboard?.writeText(item.prompt)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <figure className='group relative mb-4 break-inside-avoid overflow-hidden rounded-xl border border-border bg-card transition-shadow hover:shadow-lg'>
      <div className='relative aspect-auto w-full overflow-hidden bg-muted'>
        {cover ? (
          <img
            src={cover}
            alt={item.title}
            loading='lazy'
            className='block w-full transition-transform duration-300 group-hover:scale-[1.03]'
          />
        ) : (
          <div className='flex aspect-[4/3] w-full items-center justify-center text-muted-foreground'>
            <Video className='size-8' />
          </div>
        )}
        {item.type === 'video' && (
          <span className='absolute left-2 top-2 inline-flex items-center gap-1 rounded-md bg-black/55 px-1.5 py-0.5 text-[11px] font-medium text-white'>
            <Video className='size-3' /> {t('Video')}
          </span>
        )}
      </div>

      {/* hover 提示词浮层 */}
      <div className='pointer-events-none absolute inset-x-0 bottom-0 translate-y-2 bg-gradient-to-t from-black/80 to-transparent p-3 opacity-0 transition-all duration-200 group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100'>
        <p className='line-clamp-3 mb-2 text-xs leading-relaxed text-white/90'>
          {item.prompt}
        </p>
        <div className='flex items-center gap-2'>
          <Button
            variant='secondary'
            size='sm'
            className='h-7 rounded-md bg-white/15 px-2 text-xs text-white hover:bg-white/25'
            onClick={handleCopy}
          >
            {copied ? (
              <>
                <Check className='size-3.5' /> {t('Copied')}
              </>
            ) : (
              t('Copy Prompt')
            )}
          </Button>
          {item.model && (
            <span className='truncate rounded-md bg-white/15 px-2 py-1 text-[11px] text-white/80'>
              {item.model}
            </span>
          )}
          <span className='ml-auto inline-flex items-center gap-1 text-[11px] text-white/70'>
            <Heart className='size-3' /> {item.likes}
          </span>
        </div>
      </div>

      {/* 底部标题 */}
      <figcaption className='flex items-center justify-between gap-2 px-3 py-2'>
        <span className='truncate text-sm font-medium'>{item.title}</span>
        {item.author && (
          <span className='shrink-0 text-xs text-muted-foreground'>
            {item.author}
          </span>
        )}
      </figcaption>
    </figure>
  )
}

export function GalleryCardSkeleton() {
  return (
    <div className='mb-4 break-inside-avoid overflow-hidden rounded-xl border border-border bg-card'>
      <div className='aspect-[4/3] w-full animate-pulse bg-muted' />
      <div className='space-y-2 px-3 py-2'>
        <div className='h-3.5 w-2/3 animate-pulse rounded bg-muted' />
        <div className='h-3 w-1/3 animate-pulse rounded bg-muted' />
      </div>
    </div>
  )
}
