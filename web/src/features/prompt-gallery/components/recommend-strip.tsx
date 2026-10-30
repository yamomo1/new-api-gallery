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
    <div className='border-t border-white/10 px-4 py-4 md:px-6'>
      <p className='mb-3 flex items-center gap-2 text-sm font-semibold text-white/90'>
        <span className='h-4 w-1 rounded-full bg-primary' />
        {t('Explore more prompts')}
      </p>
      <div className='-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'>
        {related.map((it) => {
          const media = parseGalleryMedia(it)
          const cover = resolveImageUrl(it.cover) || media[0]
          const isVideo = cover ? isVideoUrl(cover) : false
          return (
            <a
              key={it.id}
              href={`/prompt-gallery/${it.id}`}
              onClick={(e) => {
                if (!onSelect) return
                e.preventDefault()
                onSelect(it.id)
              }}
              className='group w-40 shrink-0 overflow-hidden rounded-xl bg-white/5 text-left ring-1 ring-white/10 transition-all duration-200 hover:bg-white/10 hover:ring-white/25 focus-visible:ring-2 focus-visible:ring-ring'
            >
              <div className='relative aspect-video w-full overflow-hidden bg-black/40'>
                {cover ? (
                  isVideo ? (
                    <video
                      src={cover}
                      muted
                      loop
                      playsInline
                      preload='metadata'
                      className='block size-full object-cover'
                    />
                  ) : (
                    <img
                      src={cover}
                      alt={it.title}
                      loading='lazy'
                      className='block size-full object-cover transition-transform duration-300 group-hover:scale-105'
                    />
                  )
                ) : (
                  <div className='flex size-full items-center justify-center text-white/30'>
                    <Video className='size-6' />
                  </div>
                )}
                {isVideo && (
                  <span className='absolute inset-0 flex items-center justify-center'>
                    <span className='flex size-7 items-center justify-center rounded-full bg-black/50 backdrop-blur-sm transition-transform duration-200 group-hover:scale-110'>
                      <Play className='size-3 fill-white text-white' />
                    </span>
                  </span>
                )}
              </div>
              <div className='px-2.5 py-2'>
                <p className='line-clamp-1 text-xs font-medium text-white/90'>
                  {it.title}
                </p>
                <p className='mt-0.5 flex items-center gap-1 text-[11px] text-white/45'>
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
