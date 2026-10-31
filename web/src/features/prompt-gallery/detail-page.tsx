import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { ChevronRight } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { PublicLayout } from '@/components/layout'
import { PageTransition } from '@/components/page-transition'
import { Skeleton } from '@/components/ui/skeleton'
import { applySeoForPath, loadSeoConfig, setSeoOverride } from '@/lib/seo'
import { requireServerSuccess } from '@/lib/server-error-message'
import { resolveImageUrl } from '@/lib/storage'
import { useAuthStore } from '@/stores/auth-store'

import { getPromptGalleryDetail } from './api'
import { GalleryDetailBody } from './components/gallery-detail-body'
import { DetailSearch } from './components/detail/detail-search'
import {
  useLikePromptGallery,
  useTogglePromptGalleryFavorite,
} from './hooks/use-prompt-gallery'
import type { PromptGalleryItem } from './types'
import {
  copyText,
  parseGalleryMedia,
  parseGalleryTags,
  readFavorites,
  readLiked,
  writeFavorites,
  writeLiked,
} from './utils'

/**
 * 提示词详情页（真路由 /prompt-gallery/:id）
 * ---------------------------------------------------------------
 * 为什么要有独立页面：弹窗形式的 /prompt-gallery?prompt=123 对搜索引擎
 * 和大模型爬虫等于不存在 —— 没有独立 URL、没有独立标题、分享出去也只是
 * 一张列表页卡片。单条提示词才是匹配用户搜索原话的长尾入口。
 *
 * 版式对齐 liblib 作品页：宽容器（1440）+ 左内容右信息栏。
 * 媒体区是一屏两张的横向轮播，每张图自带「生成信息」浮层，
 * 点图进入大图查看器。具体结构在 GalleryDetailBody 里。
 *
 * 首屏 head 由服务端 service/seo 注入；这里负责客户端跳转时的同步。
 */
export function PromptGalleryDetailPage({ id }: { id: number }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const isLoggedIn = useAuthStore((state) => Boolean(state.auth.user))

  const [likedIds, setLikedIds] = useState<Set<number>>(() => readLiked())
  const [likeCounts, setLikeCounts] = useState<Record<number, number>>({})
  const [favorites, setFavorites] = useState<Set<number>>(() => readFavorites())

  const detailQuery = useQuery({
    queryKey: ['prompt-gallery', 'detail', id],
    queryFn: async () =>
      requireServerSuccess(await getPromptGalleryDetail(id)).data,
    enabled: Number.isFinite(id) && id > 0,
    staleTime: 30 * 1000,
  })

  const item: PromptGalleryItem | undefined = detailQuery.data
  const likeMutation = useLikePromptGallery()
  const favoriteMutation = useTogglePromptGalleryFavorite()

  const media: string[] = useMemo(
    () => (item ? parseGalleryMedia(item) : []),
    [item]
  )
  const tags: string[] = useMemo(
    () => (item ? parseGalleryTags(item.tags) : []),
    [item]
  )

  // 客户端跳转时把 head 同步成这一条的标题/描述/封面（含未收录场景的 noindex）
  useEffect(() => {
    if (!item) return
    const path = `/prompt-gallery/${item.id}`
    const cover = resolveImageUrl(item.cover) || media[0] || ''
    // data: 内联占位图不是可取回的资源，不能当 og:image（服务端同样跳过）
    const shareImage =
      cover && !cover.startsWith('data:')
        ? new URL(cover, window.location.origin).toString()
        : undefined
    const typeLabel = item.type === 'video' ? 'AI 视频提示词' : 'AI 绘画提示词'
    setSeoOverride(path, {
      title: `${item.title} · ${typeLabel}`,
      description: `${item.prompt.replaceAll(/\s+/g, ' ').slice(0, 110)}。一幕AI 提示词画廊收录，中英双语可一键复制。`,
      keywords: [...tags, item.model, item.category].filter(Boolean).join(','),
      image: shareImage,
      ogType: 'article',
    })
    void loadSeoConfig().then((cfg) => {
      if (cfg) applySeoForPath(cfg, path)
    })
    return () => setSeoOverride(path, null)
    // tags/media 由 item 派生，依赖 item 即可
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item])

  // 记录不存在：明确告诉搜索引擎这张页面该下架
  useEffect(() => {
    if (!detailQuery.isError) return
    const path = `/prompt-gallery/${id}`
    setSeoOverride(path, {
      title: '提示词不存在',
      description: '这条提示词不存在或已下架，去提示词画廊看看其它作品。',
      robots: 'noindex,follow',
    })
    void loadSeoConfig().then((cfg) => {
      if (cfg) applySeoForPath(cfg, path)
    })
    return () => setSeoOverride(path, null)
  }, [detailQuery.isError, id])

  const handleLike = useCallback(
    (target: PromptGalleryItem) => {
      if (likedIds.has(target.id)) return
      likeMutation.mutate(target.id, {
        onSuccess: (data) => {
          setLikeCounts((prev) => ({ ...prev, [target.id]: data.likes }))
          const next = new Set(likedIds)
          next.add(target.id)
          setLikedIds(next)
          writeLiked(next)
        },
      })
    },
    [likedIds, likeMutation]
  )

  const toggleFavorite = useCallback(
    (galleryId: number) => {
      setFavorites((prev) => {
        const next = new Set(prev)
        if (next.has(galleryId)) next.delete(galleryId)
        else next.add(galleryId)
        if (!isLoggedIn) writeFavorites(next)
        return next
      })
      if (isLoggedIn) favoriteMutation.mutate(galleryId)
    },
    [favoriteMutation, isLoggedIn]
  )

  const handleShare = useCallback(
    async (target: PromptGalleryItem) => {
      const url = `${window.location.origin}/prompt-gallery/${target.id}`
      try {
        const coarse = window.matchMedia?.('(pointer: coarse)').matches
        if (coarse && navigator.share) {
          await navigator.share({
            title: target.title,
            text: target.prompt.slice(0, 100),
            url,
          })
          return
        }
      } catch (error) {
        if ((error as Error)?.name === 'AbortError') return
      }
      const ok = await copyText(url)
      if (ok) toast.success(t('Link copied'))
      else toast.error(t('Copy failed'))
    },
    [t]
  )

  const handleSelectRecommend = useCallback(
    (nextId: number) => {
      void navigate({
        to: '/prompt-gallery/$id',
        params: { id: String(nextId) },
      })
    },
    [navigate]
  )

  const handleTagSelect = useCallback(
    (tag: string) => {
      void navigate({ to: '/prompt-gallery', search: { tag } })
    },
    [navigate]
  )

  const isLoading = detailQuery.isLoading && Number.isFinite(id) && id > 0
  // id 非法（/prompt-gallery/abc）也按「不存在」处理，别一直转圈
  const notFound = detailQuery.isError || !Number.isFinite(id) || id <= 0

  return (
    <PublicLayout showMainContainer={false}>
      <PageTransition>
        {/* 详情页铺纯白底（浅色模式按设计稿 #FFFFFF），深色模式跟随主题 */}
        <div className='min-h-svh bg-white pt-20 pb-16 dark:bg-background'>
          {/* 内容宽度对齐参考站：1236（含 16px 内边距）→ 实际内容 1204 */}
          <div className='mx-auto w-full max-w-[1236px] px-4'>
            {/* 面包屑 + 搜索：面包屑走内链，搜索是站内长尾入口 */}
            <div className='mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
              <nav
                aria-label={t('Breadcrumb')}
                className='flex flex-wrap items-center gap-1 text-[11.5px] text-muted-foreground'
              >
                <Link to='/' className='transition-colors hover:text-foreground'>
                  {t('Home')}
                </Link>
                <ChevronRight className='size-3.5' />
                <Link
                  to='/prompt-gallery'
                  className='transition-colors hover:text-foreground'
                >
                  {t('Prompt Gallery')}
                </Link>
                {item && (
                  <>
                    <ChevronRight className='size-3.5' />
                    <span className='line-clamp-1 text-foreground/80'>
                      {item.title}
                    </span>
                  </>
                )}
              </nav>
              <DetailSearch className='w-full sm:w-[280px]' />
            </div>

            {isLoading && (
              <div className='grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_362px]'>
                <div className='space-y-5'>
                  <Skeleton className='h-8 w-2/3' />
                  <Skeleton className='aspect-[3/4] w-full rounded-lg' />
                  <Skeleton className='h-32 w-full rounded-xl' />
                </div>
                <div className='space-y-3'>
                  <Skeleton className='h-24 w-full rounded-xl' />
                  <Skeleton className='h-40 w-full rounded-xl' />
                </div>
              </div>
            )}

            {!isLoading && (notFound || !item) && (
              <div className='py-24 text-center'>
                <h1 className='text-2xl font-semibold'>
                  {t('Prompt not found')}
                </h1>
                <p className='mt-3 text-muted-foreground'>
                  {t(
                    'This prompt may have been removed. Browse the gallery for more.'
                  )}
                </p>
                <Link
                  to='/prompt-gallery'
                  className='mt-6 inline-flex h-9 items-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90'
                >
                  {t('Back to gallery')}
                </Link>
              </div>
            )}

            {!isLoading && !notFound && item && (
              <GalleryDetailBody
                item={item}
                liked={likedIds.has(item.id)}
                likeCount={likeCounts[item.id] ?? item.likes}
                onLike={handleLike}
                favorited={favorites.has(item.id)}
                onToggleFavorite={toggleFavorite}
                onShare={handleShare}
                onTagSelect={handleTagSelect}
                onSelectRecommend={handleSelectRecommend}
                variant='page'
              />
            )}
          </div>
        </div>
      </PageTransition>
    </PublicLayout>
  )
}

export default PromptGalleryDetailPage
