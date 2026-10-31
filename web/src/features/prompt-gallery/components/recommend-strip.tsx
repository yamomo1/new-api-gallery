import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Eye, Play, Video } from 'lucide-react'
import { useMemo } from 'react'

import { resolveImageUrl } from '@/lib/storage'

import { getPromptGalleryList } from '../api'
import { requireServerSuccess } from '@/lib/server-error-message'
import type { PromptGalleryItem } from '../types'
import { isVideoUrl, parseGalleryMedia } from '../utils'

/**
 * 「探索更多提示」横滑条：同类型热门作品。
 * 详情弹窗与详情页共用；点击交给上层决定（弹窗里切换、页面里跳路由）。
 * 每项都是真 <a href>，内部链接可被爬虫顺着抓。
 */
export function RecommendStrip({
  item,
  onSelect,
}: {
  item: PromptGalleryItem
  onSelect?: (id: number) => void
}) {
  const { t } = useTranslation()
  const { data } = useQuery({
    queryKey: ['prompt-gallery', 'related', item.type, item.id],
    queryFn: async () =>
      requireServerSuccess(
        await getPromptGalleryList({ type: item.type, sort: 'popular', limit: 10 })
      ).data,
    staleTime: 60 * 1000,
  })

  const related = useMemo(
    () => (data?.items ?? []).filter((it) => it.id !== item.id).slice(0, 8),
    [data, item.id]
  )
  if (related.length === 0) return null

  return (
    <div className='border-t border-border/60 py-4'>
      {/* 标题靠右、字号加大，作为左栏内容的收尾分隔（对齐设计稿） */}
      <p className='mb-3 flex items-center justify-end gap-2 text-[17px] font-semibold text-foreground/90'>
        <span className='h-[18px] w-1 rounded-full bg-primary' />
        {t('Explore more prompts')}
      </p>
      <div className='flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'>
        {related.map((it) => {
          const media = parseGalleryMedia(it)
          const cover = resolveImageUrl(it.cover) || media[0]
          const isVideo = cover ? isVideoUrl(cover) : false
          // 缩略图三种状态先算好，避免 JSX 里写嵌套三元
          let thumb = (
            <div className='flex size-full items-center justify-center text-muted-foreground/50'>
              <Video className='size-6' />
            </div>
          )
          if (cover && isVideo) {
            thumb = (
              <video
                src={cover}
                muted
                loop
                playsInline
                preload='metadata'
                className='block size-full object-cover'
              />
            )
          } else if (cover) {
            thumb = (
              <img
                src={cover}
                alt={it.title}
                loading='lazy'
                className='block size-full object-cover transition-transform duration-300 group-hover:scale-105'
              />
            )
          }
          return (
            <a
              key={it.id}
              href={`/prompt-gallery/${it.id}`}
              onClick={(e) => {
                if (!onSelect) return
                e.preventDefault()
                onSelect(it.id)
              }}
              className='group w-40 shrink-0 overflow-hidden rounded-xl bg-card text-left ring-1 ring-border/60 transition-all duration-200 hover:bg-muted hover:ring-border focus-visible:ring-2 focus-visible:ring-ring'
            >
              <div className='relative aspect-video w-full overflow-hidden bg-black/40'>
                {thumb}
                {isVideo && (
                  <span className='absolute inset-0 flex items-center justify-center'>
                    <span className='flex size-7 items-center justify-center rounded-full bg-black/50 backdrop-blur-sm transition-transform duration-200 group-hover:scale-110'>
                      <Play className='size-3 fill-white text-white' />
                    </span>
                  </span>
                )}
              </div>
              <div className='px-2.5 py-2'>
                <p className='line-clamp-1 text-xs font-medium text-foreground/90'>
                  {it.title}
                </p>
                <p className='mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground'>
                  <Eye className='size-3' /> {it.views}
                </p>
              </div>
            </a>
          )
        })}
      </div>
    </div>
  )
}
