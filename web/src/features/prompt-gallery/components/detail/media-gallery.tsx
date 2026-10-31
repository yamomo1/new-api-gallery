import { ChevronLeft, ChevronRight, ImageOff, Info, Play, Video } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

import type { PromptGalleryItem } from '../../types'
import { isVideoUrl } from '../../utils'
import { GenerationPopover } from './generation-popover'

/**
 * 媒体区：并排双图 + 左右切换 + 每张图右下角的「生成信息」浮层
 * ---------------------------------------------------------------
 * 版式对齐 liblib 作品详情：
 *  - 桌面一屏两张，移动端一张，横向 snap 滚动（箭头 = 滚一屏）；
 *  - 每张图右下角一个「生成信息」按钮，点开是覆盖在图片上的卡片
 *    （提示词可滚动 + 模型信息 + 做同款）；
 *  - 点图片本身打开大图查看器（MediaLightbox）。
 *
 * 用原生滚动而不是 transform 轮播：两张并排时能部分露出「还有下一张」，
 * 触屏也能直接左右滑，不用额外手势库。
 */
export function MediaGallery({
  item,
  media,
  onOpenViewer,
  onScrollToCreate,
}: {
  item: PromptGalleryItem
  media: string[]
  onOpenViewer: (index: number) => void
  onScrollToCreate: () => void
}) {
  const { t } = useTranslation()
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const [canPrev, setCanPrev] = useState(false)
  const [canNext, setCanNext] = useState(false)

  const syncArrows = useCallback(() => {
    const el = scrollerRef.current
    if (!el) return
    setCanPrev(el.scrollLeft > 8)
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 8)
  }, [])

  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    syncArrows()
    el.addEventListener('scroll', syncArrows, { passive: true })
    window.addEventListener('resize', syncArrows)
    return () => {
      el.removeEventListener('scroll', syncArrows)
      window.removeEventListener('resize', syncArrows)
    }
  }, [syncArrows, media.length])

  // 切作品时回到第一屏，并收起浮层
  useEffect(() => {
    setOpenIndex(null)
    scrollerRef.current?.scrollTo({ left: 0 })
    syncArrows()
  }, [item.id, syncArrows])

  // 打开浮层时若图片滚出视野，点外面关闭
  useEffect(() => {
    if (openIndex === null) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenIndex(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openIndex])

  const page = (direction: 1 | -1) => {
    const el = scrollerRef.current
    if (!el) return
    el.scrollBy({ left: direction * el.clientWidth, behavior: 'smooth' })
  }

  const multiple = media.length > 1

  if (media.length === 0) {
    return (
      <div className='flex aspect-[3/4] max-h-[420px] w-full items-center justify-center rounded-lg bg-muted text-muted-foreground/50'>
        <ImageOff className='size-9' />
      </div>
    )
  }

  return (
    <div className='relative'>
      <div
        ref={scrollerRef}
        className='flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 [scrollbar-width:none] md:gap-4 [&::-webkit-scrollbar]:hidden'
      >
        {media.map((src, i) => {
          const video = isVideoUrl(src)
          return (
            <figure
              key={src}
              className={cn(
                'group relative m-0 shrink-0 snap-start overflow-hidden rounded-lg bg-muted',
                // 多图一屏两张；单图限制最大宽度，避免 1000px 宽的正方形把首屏撑爆
                multiple
                  ? 'w-full md:w-[calc((100%-1rem)/2)]'
                  : 'mx-auto w-full max-w-[560px]'
              )}
            >
              <button
                type='button'
                onClick={() => onOpenViewer(i)}
                aria-label={t('View full image')}
                className='block w-full cursor-zoom-in'
              >
                {video ? (
                  <div className='relative'>
                    <video
                      src={src}
                      muted
                      loop
                      playsInline
                      preload='metadata'
                      className='block aspect-[3/4] w-full object-cover'
                    />
                    <span className='pointer-events-none absolute inset-0 flex items-center justify-center'>
                      <span className='flex size-14 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm'>
                        <Play className='size-6 fill-current' />
                      </span>
                    </span>
                  </div>
                ) : (
                  <img
                    src={src}
                    alt={item.title}
                    loading={i === 0 ? 'eager' : 'lazy'}
                    className='block aspect-[3/4] w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]'
                  />
                )}
              </button>

              {/* 生成信息入口：固定在图片右下角，浮层也从这里展开 */}
              <button
                type='button'
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                aria-expanded={openIndex === i}
                className={cn(
                  'absolute right-3 bottom-3 z-10 inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-medium shadow-sm ring-1 ring-black/5 backdrop-blur-sm transition-colors',
                  // 按钮压在图片上，始终白底黑字（深色主题下 text-foreground 会变白 → 不可读）
                  openIndex === i
                    ? 'bg-neutral-900 text-white'
                    : 'bg-white/90 text-neutral-900 hover:bg-white'
                )}
              >
                <Info className='size-3.5' />
                {t('Generation info', { defaultValue: '生成信息' })}
              </button>

              {/* 视频/多图角标 */}
              {video && (
                <span className='pointer-events-none absolute top-3 left-3 inline-flex items-center gap-1 rounded-full bg-black/45 px-2 py-1 text-[11px] text-white backdrop-blur-sm'>
                  <Video className='size-3' />
                  {t('Video', { defaultValue: '视频' })}
                </span>
              )}

              {openIndex === i && (
                <GenerationPopover
                  item={item}
                  onUse={() => {
                    setOpenIndex(null)
                    onScrollToCreate()
                  }}
                />
              )}
            </figure>
          )
        })}
      </div>

      {multiple && (
        <>
          <button
            type='button'
            onClick={() => page(-1)}
            disabled={!canPrev}
            aria-label={t('Previous image')}
            className={cn(
              'absolute top-1/2 left-2 z-20 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-black shadow-md ring-1 ring-black/5 transition-all hover:bg-white',
              !canPrev && 'pointer-events-none opacity-0'
            )}
          >
            <ChevronLeft className='size-5' />
          </button>
          <button
            type='button'
            onClick={() => page(1)}
            disabled={!canNext}
            aria-label={t('Next image')}
            className={cn(
              'absolute top-1/2 right-2 z-20 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-black shadow-md ring-1 ring-black/5 transition-all hover:bg-white',
              !canNext && 'pointer-events-none opacity-0'
            )}
          >
            <ChevronRight className='size-5' />
          </button>
        </>
      )}
    </div>
  )
}
