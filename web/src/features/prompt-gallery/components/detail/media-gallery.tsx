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
  // 浮层挂在哪个按钮上（同时记录按钮位置，用来贴着按钮定位）
  const [anchor, setAnchor] = useState<{ index: number; rect: DOMRect } | null>(
    null
  )
  // 点按钮「钉住」的浮层（钉住后移开鼠标也不消失）
  const [pinnedIndex, setPinnedIndex] = useState<number | null>(null)
  const closeTimer = useRef<number | null>(null)

  const cancelClose = useCallback(() => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
  }, [])

  // 离开按钮/浮层后延迟关闭，留出从按钮移到浮层的鼠标路径
  const scheduleClose = useCallback(() => {
    cancelClose()
    closeTimer.current = window.setTimeout(() => {
      setAnchor(null)
      setPinnedIndex(null)
      closeTimer.current = null
    }, 160)
  }, [cancelClose])

  useEffect(() => cancelClose, [cancelClose])

  // 切作品时回到第一屏，并收起浮层
  useEffect(() => {
    setAnchor(null)
    setPinnedIndex(null)
    scrollerRef.current?.scrollTo({ left: 0 })
  }, [item.id])

  // 浮层是 fixed 定位，页面/容器一滚就错位，直接收起
  useEffect(() => {
    if (!anchor) return
    const close = () => {
      setAnchor(null)
      setPinnedIndex(null)
    }
    window.addEventListener('scroll', close, { passive: true, capture: true })
    window.addEventListener('resize', close)
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('scroll', close, { capture: true })
      window.removeEventListener('resize', close)
      window.removeEventListener('keydown', onKey)
    }
  }, [anchor])

  // 钉住状态下点空白处关闭
  useEffect(() => {
    if (!anchor || pinnedIndex === null) return
    const onDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      if (!target) return
      if (target.closest('[role="dialog"]')) return
      if (target.closest('[data-geninfo-btn]')) return
      setAnchor(null)
      setPinnedIndex(null)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [anchor, pinnedIndex])

  const openAt = useCallback(
    (index: number, el: HTMLElement) => {
      cancelClose()
      setAnchor({ index, rect: el.getBoundingClientRect() })
    },
    [cancelClose]
  )

  // 循环翻页：到最后一屏再点「下一张」回到第一屏，第一屏点「上一张」回最后一屏
  const page = (direction: 1 | -1) => {
    const el = scrollerRef.current
    if (!el) return
    const max = el.scrollWidth - el.clientWidth
    if (max <= 0) return
    if (direction === 1 && el.scrollLeft >= max - 8) {
      el.scrollTo({ left: 0, behavior: 'smooth' })
      return
    }
    if (direction === -1 && el.scrollLeft <= 8) {
      el.scrollTo({ left: max, behavior: 'smooth' })
      return
    }
    el.scrollBy({ left: direction * el.clientWidth, behavior: 'smooth' })
  }

  const multiple = media.length > 1

  if (media.length === 0) {
    return (
      <div className='flex h-[520px] w-full items-center justify-center rounded-[13px] bg-[#f6f6f6] text-muted-foreground/50 md:h-[600px] dark:bg-muted'>
        <ImageOff className='size-9' />
      </div>
    )
  }

  return (
    <div className='relative'>
      <div
        ref={scrollerRef}
        className='flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
      >
        {media.map((src, i) => {
          const video = isVideoUrl(src)
          return (
            <figure
              key={src}
              className={cn(
                // 参考站：卡片 413×600、间距 8、圆角 13、底色 #F6F6F6、图片 contain 不裁切
                'group relative m-0 shrink-0 snap-start overflow-hidden rounded-[13px] bg-[#f6f6f6] dark:bg-muted',
                multiple
                  ? 'w-full md:w-[calc((100%-0.5rem)/2)]'
                  : 'w-full md:w-[calc((100%-0.5rem)/2)]'
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
                      className='block h-[520px] w-full object-contain md:h-[600px]'
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
                    className='block h-[520px] w-full object-contain transition-transform duration-500 group-hover:scale-[1.01] md:h-[600px]'
                  />
                )}
              </button>

              {/* 生成信息入口：固定在图片右下角，浮层也从这里展开 */}
              <button
                type='button'
                data-geninfo-btn
                onMouseEnter={(event) => openAt(i, event.currentTarget)}
                onMouseLeave={scheduleClose}
                onFocus={(event) => openAt(i, event.currentTarget)}
                onBlur={scheduleClose}
                onClick={(event) => {
                  if (pinnedIndex === i) {
                    setPinnedIndex(null)
                    setAnchor(null)
                    return
                  }
                  setPinnedIndex(i)
                  openAt(i, event.currentTarget)
                }}
                aria-expanded={anchor?.index === i}
                className={cn(
                  'absolute right-3 bottom-3 z-10 inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-medium shadow-sm ring-1 ring-black/5 backdrop-blur-sm transition-colors',
                  // 按钮压在图片上，始终白底黑字（深色主题下 text-foreground 会变白 → 不可读）
                  anchor?.index === i
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

            </figure>
          )
        })}
      </div>

      {anchor && (
        <GenerationPopover
          item={item}
          anchorRect={anchor.rect}
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
          onUse={() => {
            setAnchor(null)
            setPinnedIndex(null)
            onScrollToCreate()
          }}
        />
      )}

      {multiple && (
        <>
          <button
            type='button'
            onClick={() => page(-1)}
            aria-label={t('Previous image')}
            className='absolute top-1/2 left-2 z-20 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/25 text-white backdrop-blur-sm transition-colors hover:bg-black/40'
          >
            <ChevronLeft className='size-5' />
          </button>
          <button
            type='button'
            onClick={() => page(1)}
            aria-label={t('Next image')}
            className='absolute top-1/2 right-2 z-20 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/25 text-white backdrop-blur-sm transition-colors hover:bg-black/40'
          >
            <ChevronRight className='size-5' />
          </button>
        </>
      )}
    </div>
  )
}
