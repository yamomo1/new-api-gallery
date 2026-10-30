import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  Check,
  Copy,
  ExternalLink,
  Eye,
  Heart,
  Play,
  Share2,
  Star,
  Video,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { motion } from 'motion/react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { runningHubInviteUrl } from '@/features/canvas/runninghub'
import { requireServerSuccess } from '@/lib/server-error-message'
import { cn } from '@/lib/utils'
import { resolveImageUrl } from '@/lib/storage'

import { getPromptGalleryDetail, getPromptGalleryList } from '../api'
import { useLikePromptGallery } from '../hooks/use-prompt-gallery'
import type { PromptGalleryItem } from '../types'
import {
  copyText,
  isVideoUrl,
  parseGalleryMedia,
  parseGalleryTags,
} from '../utils'

type GalleryDetailDialogProps = {
  id: number | null
  onClose: () => void
  /** 服务端数据回退（列表项），详情接口加载前先展示 */
  fallback?: PromptGalleryItem | null
  liked?: boolean
  likeCount?: number
  onLike?: (item: PromptGalleryItem) => void
  favorite?: boolean
  onToggleFavorite?: (id: number) => void
  /** 分享单个作品（复制直达链接 / 系统分享） */
  onShare?: (item: PromptGalleryItem) => void
  /** 点击「探索更多提示」里的推荐 → 切换到该作品 */
  onSelect?: (id: number) => void
  /** 点击标签 chip → 关闭弹窗并应用标签筛选 */
  onTagSelect?: (tag: string) => void
}

/** 提示词展示块：双语（英文/中文）Tab + 使用此提示 + 复制 */
function PromptBlock({ item }: { item: PromptGalleryItem }) {
  const { t } = useTranslation()
  const bilingual = Boolean(item.prompt_en && item.prompt_en.trim())
  const [lang, setLang] = useState<'en' | 'zh'>('en')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setCopied(false)
    setLang('en')
  }, [item.id])

  const text = bilingual && lang === 'en' ? item.prompt_en! : item.prompt

  const handleCopy = async () => {
    const ok = await copyText(text)
    if (ok) {
      setCopied(true)
      toast.success(t('Prompt copied'))
      setTimeout(() => setCopied(false), 1500)
    } else {
      toast.error(t('Copy failed'))
    }
  }

  return (
    <div className='rounded-2xl border border-border bg-muted/40 p-4'>
      <div className='mb-3 flex items-center justify-between gap-2'>
        {bilingual ? (
          <div className='inline-flex rounded-full bg-muted p-0.5'>
            {(
              [
                { key: 'en', label: t('English') },
                { key: 'zh', label: t('Chinese') },
              ] as const
            ).map(({ key, label }) => (
              <button
                key={key}
                type='button'
                aria-pressed={lang === key}
                onClick={() => setLang(key)}
                className={cn(
                  'rounded-full px-3.5 py-1 text-[13px] font-medium transition-colors',
                  lang === key
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {label}
              </button>
            ))}
          </div>
        ) : (
          <span className='text-sm font-semibold'>{t('Prompt')}</span>
        )}
        <div className='flex items-center gap-1'>
          <Button
            size='sm'
            className='h-7 gap-1 rounded-full px-3 text-xs'
            onClick={handleCopy}
          >
            {t('Use this prompt')}
          </Button>
          <Button
            variant='ghost'
            size='sm'
            className='h-7 w-7 p-0'
            aria-label={t('Copy Prompt')}
            title={t('Copy Prompt')}
            onClick={handleCopy}
          >
            {copied ? <Check className='size-3.5' /> : <Copy className='size-3.5' />}
          </Button>
        </div>
      </div>
      <p className='max-h-64 overflow-y-auto text-sm leading-relaxed whitespace-pre-wrap text-foreground/90'>
        {text}
      </p>
      {/* 外链走 runningHubUrl 单一真源，始终带推广码；勿手拼 URL */}
      <div className='mt-3 flex items-center justify-end'>
        <a
          href={runningHubInviteUrl()}
          target='_blank'
          rel='noopener noreferrer'
          title={t('Opens RunningHub in a new tab with your invite code')}
          className='inline-flex items-center gap-1 text-xs font-medium text-primary transition-colors hover:text-primary/80'
        >
          <ExternalLink className='size-3.5' />
          {t('Try on RunningHub')}
        </a>
      </div>
    </div>
  )
}

/** 视频下方「探索更多提示」：同类型热门横滑，点击切换详情 */
function RecommendStrip({
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
            <button
              key={it.id}
              type='button'
              onClick={() => onSelect?.(it.id)}
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
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** 作品详情弹窗（全屏）：左媒体+推荐 / 右信息+双语提示词 */
export function GalleryDetailDialog({
  id,
  onClose,
  fallback,
  liked,
  likeCount,
  onLike,
  favorite,
  onToggleFavorite,
  onShare,
  onSelect,
  onTagSelect,
}: GalleryDetailDialogProps) {
  const { t } = useTranslation()
  const [activeMedia, setActiveMedia] = useState(0)

  const detailQuery = useQuery({
    queryKey: ['prompt-gallery', 'detail', id],
    queryFn: async () =>
      requireServerSuccess(await getPromptGalleryDetail(id!)).data,
    enabled: id !== null,
    staleTime: 30 * 1000,
  })

  const likeMutation = useLikePromptGallery()

  // 切换作品时重置媒体下标
  useEffect(() => {
    setActiveMedia(0)
  }, [id])

  const item: PromptGalleryItem | undefined =
    detailQuery.data ?? fallback ?? undefined

  const media: string[] = item ? parseGalleryMedia(item) : []
  const tags: string[] = item ? parseGalleryTags(item.tags) : []
  const current = media[Math.min(activeMedia, Math.max(media.length - 1, 0))]

  const handleLike = () => {
    if (!item || liked) return
    if (onLike) {
      onLike(item)
    } else {
      likeMutation.mutate(item.id)
    }
  }

  return (
    <Dialog open={id !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        className='h-[100dvh] max-h-none w-screen max-w-none gap-0 overflow-hidden rounded-none border-0 bg-background p-0 sm:max-w-none'
      >
        <DialogTitle className='sr-only'>
          {item?.title || t('Prompt Gallery')}
        </DialogTitle>

        {!item ? (
          <div className='grid h-full gap-6 p-6 md:grid-cols-[1.4fr_1fr]'>
            <Skeleton className='aspect-video w-full rounded-2xl' />
            <div className='space-y-4'>
              <Skeleton className='h-8 w-2/3' />
              <Skeleton className='h-40 w-full' />
            </div>
          </div>
        ) : (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
            className='grid h-full min-h-0 overflow-y-auto md:grid-cols-[minmax(0,1.4fr)_minmax(360px,1fr)] md:overflow-hidden'
          >
            {/* 左列：媒体（顶部）+ 探索更多提示（下方），整列黑底 */}
            <div className='relative flex min-h-0 flex-col bg-black/95'>
              {/* 关闭按钮：贴在视频右上角 */}
              <button
                type='button'
                aria-label={t('Close')}
                onClick={onClose}
                className='absolute top-4 right-4 z-20 flex size-9 items-center justify-center rounded-full bg-white/10 text-white/85 ring-1 ring-white/20 backdrop-blur-sm transition-colors hover:bg-white/20 hover:text-white'
              >
                <X className='size-4.5' />
              </button>

              <div className='relative flex min-h-0 flex-1 items-center justify-center p-4 md:p-8'>
                {current ? (
                  isVideoUrl(current) ? (
                    <video
                      key={current}
                      src={current}
                      controls
                      autoPlay
                      loop
                      muted
                      playsInline
                      className='max-h-[46vh] w-full rounded-xl object-contain md:max-h-[calc(100dvh-14rem)]'
                    />
                  ) : (
                    <img
                      key={current}
                      src={current}
                      alt={item.title}
                      className='max-h-[46vh] w-full rounded-xl object-contain md:max-h-[calc(100dvh-14rem)]'
                    />
                  )
                ) : (
                  <div className='flex aspect-video w-full items-center justify-center text-white/40'>
                    <Video className='size-10' />
                  </div>
                )}

                {media.length > 1 && (
                  <div className='absolute inset-x-0 bottom-3 flex justify-center gap-1.5'>
                    {media.map((_, i) => (
                      <button
                        key={i}
                        type='button'
                        aria-label={`${i + 1}`}
                        onClick={() => setActiveMedia(i)}
                        className={cn(
                          'size-2 rounded-full bg-white/40 transition-colors',
                          i === activeMedia && 'bg-white'
                        )}
                      />
                    ))}
                  </div>
                )}
              </div>

              <RecommendStrip item={item} onSelect={onSelect} />
            </div>

            {/* 右列：信息区 */}
            <div className='flex min-h-0 flex-col gap-5 overflow-y-auto p-5 md:p-7'>
              <div className='flex flex-wrap items-center gap-1.5'>
                {item.model && (
                  <Badge className='rounded-full px-2.5'>{item.model}</Badge>
                )}
                <Badge variant='outline' className='rounded-full'>
                  {item.type === 'video' ? t('Video prompt') : t('Image prompt')}
                </Badge>
                {item.category && (
                  <Badge variant='outline' className='rounded-full text-muted-foreground'>
                    {item.category}
                  </Badge>
                )}
              </div>

              <div>
                <h2 className='text-2xl font-semibold leading-snug tracking-tight'>
                  {item.title}
                </h2>
                <div className='mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted-foreground'>
                  {item.author && (
                    <span className='font-medium text-foreground/80'>
                      @{item.author}
                    </span>
                  )}
                  <span className='inline-flex items-center gap-1'>
                    <Eye className='size-3.5' /> {item.views}
                  </span>
                  <span className='inline-flex items-center gap-1'>
                    <Heart className='size-3.5' /> {likeCount ?? item.likes}
                  </span>
                </div>
              </div>

              {tags.length > 0 && (
                <div className='flex flex-wrap gap-1.5'>
                  {tags.map((tag) => (
                    <button
                      key={tag}
                      type='button'
                      onClick={() => onTagSelect?.(tag)}
                      className='rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-foreground'
                    >
                      #{tag}
                    </button>
                  ))}
                </div>
              )}

              <PromptBlock item={item} />

              <div className='mt-auto flex flex-wrap items-center gap-2 pt-2'>
                <Button
                  variant={liked ? 'default' : 'outline'}
                  size='sm'
                  className='gap-1.5 rounded-full'
                  onClick={handleLike}
                  disabled={liked}
                >
                  <Heart className={cn('size-4', liked && 'fill-current')} />
                  {likeCount ?? item.likes}
                </Button>
                {onToggleFavorite && (
                  <Button
                    variant={favorite ? 'default' : 'outline'}
                    size='sm'
                    className='gap-1.5 rounded-full'
                    onClick={() => onToggleFavorite(item.id)}
                  >
                    <Star className={cn('size-4', favorite && 'fill-current')} />
                    {favorite ? t('Favorited') : t('Favorite')}
                  </Button>
                )}
                {onShare && (
                  <Button
                    variant='outline'
                    size='sm'
                    className='gap-1.5 rounded-full'
                    onClick={() => onShare(item)}
                  >
                    <Share2 className='size-4' />
                    {t('Share work')}
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </DialogContent>
    </Dialog>
  )
}
