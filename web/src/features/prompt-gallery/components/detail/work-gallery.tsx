import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Heart, ImagePlus, Play, Video, Wand2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { requireServerSuccess } from '@/lib/server-error-message'
import { resolveImageUrl } from '@/lib/storage'
import { cn } from '@/lib/utils'

import { getPromptGalleryList } from '../../api'
import type { PromptGalleryItem, PromptGallerySort } from '../../types'
import { isVideoUrl, parseGalleryMedia } from '../../utils'
import { MasonryGrid } from '../masonry-grid'

/**
 * 作品展示（对齐 liblib 模型页的 UGC 区）
 * ---------------------------------------------------------------
 * 结构：标题「作品展示 (n)」+ 最热/最新 切换 + 右侧「我要晒图」下拉 + 四列瀑布流。
 *
 * 数据说明：目标站这里是「同一模型的二创晒图」，我们没有晒图表，
 * 用同类型的其他作品顶上（点开进对应详情页），不做假数据。
 * 「我要晒图」下拉的两项都跳「我的作品 → 新建」，那里能选图片或视频上传。
 */
export function WorkGallery({
  item,
  onSelect,
  onOpenCreate,
}: {
  item: PromptGalleryItem
  onSelect?: (id: number) => void
  /** 「做同款」：详情页传入带 ?create=1 的跳转；弹窗场景不传则回退到 onSelect */
  onOpenCreate?: (id: number) => void
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [sort, setSort] = useState<PromptGallerySort>('popular')

  const { data } = useQuery({
    queryKey: ['prompt-gallery', 'work-showcase', item.id, sort],
    queryFn: async () =>
      requireServerSuccess(
        // 不按 type 过滤：同一模型/同类作品的晒图墙经常图文混排，只按热度取全站作品
        await getPromptGalleryList({ sort, limit: 24 })
      ).data,
    staleTime: 60 * 1000,
  })

  const works = useMemo(
    () => (data?.items ?? []).filter((it) => it.id !== item.id),
    [data, item.id]
  )
  const total = Math.max((data?.total ?? 0) - 1, works.length)

  const goCreate = () => {
    void navigate({ to: '/my-works', search: { create: true } })
  }

  const tabs: { key: PromptGallerySort; label: string }[] = [
    { key: 'popular', label: t('Hottest', { defaultValue: '最热' }) },
    { key: 'latest', label: t('Latest', { defaultValue: '最新' }) },
  ]

  return (
    <section>
      <div className='mb-4 flex items-start justify-between gap-3'>
        <div>
          <h2 className='text-[17px] font-semibold text-foreground'>
            {t('Work showcase', { defaultValue: '作品展示' })}
            <span className='ml-2 text-[14px] font-normal text-muted-foreground'>
              ({total})
            </span>
          </h2>

          <div className='mt-3 flex items-center gap-3 text-[13px]'>
            {tabs.map((tab, i) => (
              <span key={tab.key} className='flex items-center gap-2'>
                {i > 0 && <span className='text-border'>|</span>}
                <button
                  type='button'
                  onClick={() => setSort(tab.key)}
                  className={cn(
                    'transition-colors',
                    sort === tab.key
                      ? 'font-medium text-foreground'
                      : 'text-muted-foreground hover:text-foreground/80'
                  )}
                >
                  {tab.label}
                </button>
              </span>
            ))}
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger className='inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-[#F4F5F9] px-4 text-[13px] text-foreground/85 transition-colors hover:bg-[#EEF0F5] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none dark:bg-muted'>
            <ImagePlus className='size-4' />
            {t('Share your work', { defaultValue: '我要晒图' })}
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end'>
            <DropdownMenuItem onClick={goCreate}>
              <ImagePlus className='size-4' />
              {t('Upload image', { defaultValue: '上传图片' })}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={goCreate}>
              <Video className='size-4' />
              {t('Upload video', { defaultValue: '上传视频' })}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {works.length === 0 ? (
        <p className='py-10 text-center text-[13px] text-muted-foreground'>
          {t('No works yet', { defaultValue: '暂无作品' })}
        </p>
      ) : (
        // 真·瀑布流：复用 MasonryGrid，按「当前最矮列」贪心分配，列高自动平衡、
        // 图片加载/悬浮展开时只推挤本列、绝不跨列闪跳（设计规范 §8.8）。
        // gap 维持原 2.5(10px) 间距，卡片视觉样式完全不变。
        <MasonryGrid
          items={works}
          getKey={(it) => it.id}
          deps={[sort]}
          gap={10}
          estimateHeight={260}
          renderItem={(it, _i, ref) => {
            const media = parseGalleryMedia(it)
            const cover = resolveImageUrl(it.cover) || media[0]
            const isVideo = cover ? isVideoUrl(cover) : false

            // 三种封面先算好，避免 JSX 里叠三元
            let thumb = (
              <div className='flex aspect-[3/4] w-full items-center justify-center text-muted-foreground/40'>
                <Video className='size-6' />
              </div>
            )
            if (cover && isVideo) {
              thumb = (
                <div className='relative'>
                  <video
                    src={cover}
                    muted
                    loop
                    playsInline
                    preload='metadata'
                    className='block w-full'
                  />
                  <span className='pointer-events-none absolute inset-0 flex items-center justify-center'>
                    <span className='flex size-8 items-center justify-center rounded-full bg-black/45 text-white'>
                      <Play className='size-3.5 fill-current' />
                    </span>
                  </span>
                </div>
              )
            } else if (cover) {
              thumb = (
                <img
                  src={cover}
                  alt={it.title}
                  loading='lazy'
                  className='block min-h-[120px] w-full object-cover transition-opacity group-hover:opacity-90'
                />
              )
            }

            const initial = (it.author || '?').trim().slice(0, 1).toUpperCase()

            return (
              <div
                ref={ref}
                className='group relative overflow-hidden rounded-xl bg-muted transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-[0_0_0_1px_rgba(15,20,25,0.06),0_22px_44px_-18px_rgba(15,20,25,0.45)]'
              >
                <a
                  href={`/prompt-gallery/${it.id}`}
                  title={it.title}
                  onClick={(event) => {
                    if (!onSelect) return
                    event.preventDefault()
                    onSelect(it.id)
                  }}
                  className='block'
                >
                  <span className='block overflow-hidden'>{thumb}</span>
                </a>

                {/* 悬浮信息层：底部渐变 + 作者/标题 + 做同款/点赞（对齐参考站） */}
                <div className='pointer-events-none absolute inset-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/80 via-black/25 to-transparent p-3 opacity-0 transition-opacity duration-300 group-hover:opacity-100'>
                  <div className='flex min-w-0 items-center gap-2'>
                    <span className='flex size-7 shrink-0 items-center justify-center rounded-full bg-white/25 text-[11px] font-medium text-white ring-1 ring-white/35 backdrop-blur-sm'>
                      {initial}
                    </span>
                    <span className='line-clamp-1 text-[13px] font-medium text-white drop-shadow-sm'>
                      {it.title}
                    </span>
                  </div>
                  <div className='flex shrink-0 items-center gap-1.5'>
                    <button
                      type='button'
                      onClick={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        if (onOpenCreate) onOpenCreate(it.id)
                        else onSelect?.(it.id)
                      }}
                      className='pointer-events-auto inline-flex h-7 items-center gap-1 rounded-full bg-black/40 px-2.5 text-[12px] text-white ring-1 ring-white/25 backdrop-blur-sm transition-colors hover:bg-black/55'
                    >
                      <Wand2 className='size-3.5' />
                      {t('Create the same', { defaultValue: '做同款' })}
                    </button>
                    <span className='inline-flex h-7 items-center gap-1 rounded-full bg-black/40 px-2.5 text-[12px] text-white ring-1 ring-white/25 backdrop-blur-sm'>
                      <Heart className='size-3.5' />
                      {it.likes}
                    </span>
                  </div>
                </div>
              </div>
            )
          }}
        />
      )}
    </section>
  )
}
