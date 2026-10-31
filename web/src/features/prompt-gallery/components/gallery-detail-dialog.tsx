import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { motion } from 'motion/react'

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { requireServerSuccess } from '@/lib/server-error-message'

import { getPromptGalleryDetail } from '../api'
import { useLikePromptGallery } from '../hooks/use-prompt-gallery'
import type { PromptGalleryItem } from '../types'
import { GalleryDetailBody } from './gallery-detail-body'

/**
 * 作品详情弹窗（全屏）：与详情页共用 GalleryDetailBody 的两栏版式。
 *
 * 注意：站点主入口是真路由 /prompt-gallery/:id（detail-page.tsx），
 * 这里保留给「列表页快速预览」场景；布局改动请改 GalleryDetailBody。
 */
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

  const detailQuery = useQuery({
    queryKey: ['prompt-gallery', 'detail', id],
    queryFn: async () =>
      requireServerSuccess(await getPromptGalleryDetail(id ?? 0)).data,
    enabled: id !== null,
    staleTime: 30 * 1000,
  })

  const likeMutation = useLikePromptGallery()

  const item: PromptGalleryItem | undefined =
    detailQuery.data ?? fallback ?? undefined

  const handleLike = (target: PromptGalleryItem) => {
    if (onLike) onLike(target)
    else likeMutation.mutate(target.id)
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

        <button
          type='button'
          aria-label={t('Close')}
          onClick={onClose}
          className='absolute top-4 right-4 z-20 flex size-9 items-center justify-center rounded-full border border-border/60 bg-background/80 text-foreground/70 backdrop-blur-sm transition-colors hover:bg-muted hover:text-foreground'
        >
          <X className='size-4.5' />
        </button>

        {!item ? (
          <div className='grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_300px]'>
            <Skeleton className='aspect-video w-full rounded-xl' />
            <div className='space-y-3'>
              <Skeleton className='h-24 w-full rounded-xl' />
              <Skeleton className='h-40 w-full rounded-xl' />
            </div>
          </div>
        ) : (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.26, ease: 'easeOut' }}
            className='h-full overflow-y-auto'
          >
            <div className='mx-auto w-full max-w-[1120px] px-4 pt-6 pb-12 md:px-6 md:pt-8'>
              <GalleryDetailBody
                item={item}
                liked={liked}
                likeCount={likeCount}
                onLike={handleLike}
                favorited={favorite}
                onToggleFavorite={onToggleFavorite}
                onShare={onShare}
                onTagSelect={onTagSelect}
                onSelectRecommend={onSelect}
                variant='dialog'
              />
            </div>
          </motion.div>
        )}
      </DialogContent>
    </Dialog>
  )
}
