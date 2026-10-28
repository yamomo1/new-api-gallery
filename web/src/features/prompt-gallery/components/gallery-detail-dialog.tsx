import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Copy, Check, Eye, Heart, Share2, Star, Video } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { requireServerSuccess } from '@/lib/server-error-message'
import { cn } from '@/lib/utils'

import { getPromptGalleryDetail } from '../api'
import { useLikePromptGallery } from '../hooks/use-prompt-gallery'
import type { PromptGalleryItem } from '../types'
import { copyText, isVideoUrl, parseGalleryMedia, parseGalleryTags } from '../utils'

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
}

/** 作品详情弹窗：媒体展示 + 完整提示词（复制）+ 点赞/收藏 */
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
}: GalleryDetailDialogProps) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
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
    setCopied(false)
  }, [id])

  const item: PromptGalleryItem | undefined =
    detailQuery.data ?? fallback ?? undefined

  const media: string[] = item ? parseGalleryMedia(item) : []
  const tags: string[] = item ? parseGalleryTags(item.tags) : []
  const current = media[Math.min(activeMedia, Math.max(media.length - 1, 0))]

  const handleCopy = async () => {
    if (!item) return
    const ok = await copyText(item.prompt)
    if (ok) {
      setCopied(true)
      toast.success(t('Prompt copied'))
      setTimeout(() => setCopied(false), 1500)
    } else {
      toast.error(t('Copy failed'))
    }
  }

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
      <DialogContent className='max-h-[88vh] overflow-y-auto p-0 sm:max-w-3xl'>
        <DialogTitle className='sr-only'>
          {item?.title || t('Prompt Gallery')}
        </DialogTitle>
        {!item ? (
          <div className='space-y-4 p-6'>
            <Skeleton className='aspect-video w-full rounded-xl' />
            <Skeleton className='h-6 w-2/3' />
            <Skeleton className='h-24 w-full' />
          </div>
        ) : (
          <div className='grid gap-0 md:grid-cols-[1.25fr_1fr]'>
            {/* 媒体区 */}
            <div className='relative flex items-center justify-center bg-black/90 md:rounded-l-xl'>
              {current ? (
                isVideoUrl(current) ? (
                  <video
                    key={current}
                    src={current}
                    controls
                    autoPlay
                    loop
                    muted
                    className='max-h-[60vh] w-full object-contain md:max-h-[80vh]'
                  />
                ) : (
                  <img
                    key={current}
                    src={current}
                    alt={item.title}
                    className='max-h-[60vh] w-full object-contain md:max-h-[80vh]'
                  />
                )
              ) : (
                <div className='flex aspect-video w-full items-center justify-center text-white/40'>
                  <Video className='size-10' />
                </div>
              )}
              {media.length > 1 && (
                <div className='absolute inset-x-0 bottom-2 flex justify-center gap-1.5'>
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

            {/* 信息区 */}
            <div className='flex flex-col gap-4 p-5'>
              <div>
                <h2 className='text-lg font-semibold leading-snug'>
                  {item.title}
                </h2>
                <div className='mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground'>
                  {item.author && <span>@{item.author}</span>}
                  <span className='inline-flex items-center gap-1'>
                    <Eye className='size-3.5' /> {item.views}
                  </span>
                </div>
              </div>

              <div className='flex flex-wrap gap-1.5'>
                {item.model && <Badge variant='secondary'>{item.model}</Badge>}
                {item.category && <Badge variant='outline'>{item.category}</Badge>}
                {item.type === 'video' && (
                  <Badge variant='outline'>
                    <Video className='size-3' /> {t('Video')}
                  </Badge>
                )}
                {tags.map((tag) => (
                  <Badge key={tag} variant='outline' className='text-muted-foreground'>
                    #{tag}
                  </Badge>
                ))}
              </div>

              {/* 提示词全文 */}
              <div className='rounded-xl border border-border bg-muted/40 p-3'>
                <div className='mb-1.5 flex items-center justify-between'>
                  <span className='text-xs font-semibold text-muted-foreground'>
                    {t('Prompt')}
                  </span>
                  <Button
                    variant='ghost'
                    size='sm'
                    className='h-7 gap-1 px-2 text-xs'
                    onClick={handleCopy}
                  >
                    {copied ? (
                      <Check className='size-3.5' />
                    ) : (
                      <Copy className='size-3.5' />
                    )}
                    {copied ? t('Copied') : t('Copy Prompt')}
                  </Button>
                </div>
                <p className='max-h-56 overflow-y-auto text-sm leading-relaxed whitespace-pre-wrap text-foreground/90'>
                  {item.prompt}
                </p>
              </div>

              <div className='mt-auto flex flex-wrap items-center gap-2'>
                <Button
                  variant={liked ? 'default' : 'outline'}
                  size='sm'
                  className='gap-1.5'
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
                    className='gap-1.5'
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
                    className='gap-1.5'
                    onClick={() => onShare(item)}
                  >
                    <Share2 className='size-4' />
                    {t('Share work')}
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
