import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { ImagePlus, Play, Video } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useMediaQuery } from '@/hooks/use-media-query'
import { requireServerSuccess } from '@/lib/server-error-message'
import { resolveImageUrl } from '@/lib/storage'
import { cn } from '@/lib/utils'

import { getPromptGalleryList } from '../../api'
import type { PromptGalleryItem, PromptGallerySort } from '../../types'
import { isVideoUrl, parseGalleryMedia } from '../../utils'

/** 固定列 key：避免用数组下标当 key（oxlint no-array-index-key） */
const COLUMN_KEYS = ['c0', 'c1', 'c2', 'c3'] as const

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
}: {
  item: PromptGalleryItem
  onSelect?: (id: number) => void
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

  // 窄屏 2 列、其余 4 列；自己分列而不用 CSS columns —— 卡片等高时浏览器会少排一列
  const narrow = useMediaQuery('(max-width: 639px)')
  const columnCount = narrow ? 2 : 4

  const works = useMemo(
    () => (data?.items ?? []).filter((it) => it.id !== item.id),
    [data, item.id]
  )
  const total = Math.max((data?.total ?? 0) - 1, works.length)

  // 轮流分配到各列，保证第一屏四列都有内容
  const columns = useMemo(() => {
    const bucket: PromptGalleryItem[][] = Array.from(
      { length: columnCount },
      () => []
    )
    works.forEach((work, i) => bucket[i % columnCount].push(work))
    return bucket
  }, [works, columnCount])

  const goCreate = () => {
    void navigate({ to: '/my-works', search: { create: true } })
  }

  const tabs: { key: PromptGallerySort; label: string }[] = [
    { key: 'popular', label: t('Hottest', { defaultValue: '最热' }) },
    { key: 'latest', label: t('Latest', { defaultValue: '最新' }) },
  ]

  return (
    <section>
      <div className='mb-2.5 flex items-start justify-between gap-3'>
        <div>
          <h2 className='text-[15px] font-medium text-foreground'>
            {t('Work showcase', { defaultValue: '作品展示' })}
            <span className='ml-1 text-[13px] font-normal text-muted-foreground'>
              ({total})
            </span>
          </h2>

          <div className='mt-2 flex items-center gap-2 text-[12.5px]'>
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
          <DropdownMenuTrigger className='inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-border/60 bg-card px-3 text-[13px] text-foreground/85 transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'>
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
        // 瀑布流：每列独立竖排，图片保持原始比例，高度自然错落（对齐参考站的晒图墙）
        <div className='flex items-start gap-2.5'>
          {columns.map((column, ci) => (
            <div
              key={COLUMN_KEYS[ci]}
              className='flex min-w-0 flex-1 flex-col gap-2.5'
            >
              {column.map((it) => {
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

                return (
                  <a
                    key={it.id}
                    href={`/prompt-gallery/${it.id}`}
                    title={it.title}
                    onClick={(event) => {
                      if (!onSelect) return
                      event.preventDefault()
                      onSelect(it.id)
                    }}
                    className='group block overflow-hidden rounded-xl bg-muted'
                  >
                    {thumb}
                  </a>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
