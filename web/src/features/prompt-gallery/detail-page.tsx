import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import {
  ChevronRight,
  Eye,
  Heart,
  Share2,
  Star,
  Video,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { PublicLayout } from '@/components/layout'
import { PageTransition } from '@/components/page-transition'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { applySeoForPath, loadSeoConfig, setSeoOverride } from '@/lib/seo'
import { requireServerSuccess } from '@/lib/server-error-message'
import { resolveImageUrl } from '@/lib/storage'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'

import { getPromptGalleryDetail } from './api'
import { CreateWithThis } from './create-with-this'
import { PromptBlock } from './components/prompt-block'
import { RecommendStrip } from './components/recommend-strip'
import {
  useLikePromptGallery,
  useTogglePromptGalleryFavorite,
} from './hooks/use-prompt-gallery'
import type { PromptGalleryItem } from './types'
import {
  copyText,
  isVideoUrl,
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
 * 首屏 head 由服务端 service/seo 注入；这里负责客户端跳转时的同步。
 */
export function PromptGalleryDetailPage({ id }: { id: number }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const isLoggedIn = useAuthStore((state) => Boolean(state.auth.user))

  const [activeMedia, setActiveMedia] = useState(0)
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

  useEffect(() => {
    setActiveMedia(0)
  }, [id])

  const media: string[] = useMemo(
    () => (item ? parseGalleryMedia(item) : []),
    [item]
  )
  const tags: string[] = useMemo(
    () => (item ? parseGalleryTags(item.tags) : []),
    [item]
  )
  const current = media[Math.min(activeMedia, Math.max(media.length - 1, 0))]

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
      description: `${item.prompt.replace(/\s+/g, ' ').slice(0, 110)}。一幕AI 提示词画廊收录，中英双语可一键复制。`,
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

  const handleLike = useCallback(() => {
    if (!item || likedIds.has(item.id)) return
    likeMutation.mutate(item.id, {
      onSuccess: (data) => {
        setLikeCounts((prev) => ({ ...prev, [item.id]: data.likes }))
        const next = new Set(likedIds)
        next.add(item.id)
        setLikedIds(next)
        writeLiked(next)
      },
    })
  }, [item, likedIds, likeMutation])

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

  const handleShare = useCallback(async () => {
    if (!item) return
    const url = `${window.location.origin}/prompt-gallery/${item.id}`
    try {
      const coarse = window.matchMedia?.('(pointer: coarse)').matches
      if (coarse && navigator.share) {
        await navigator.share({
          title: item.title,
          text: item.prompt.slice(0, 100),
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
  }, [item, t])

  const isLoading = detailQuery.isLoading && Number.isFinite(id) && id > 0
  // id 非法（/prompt-gallery/abc）也按「不存在」处理，别一直转圈
  const notFound =
    detailQuery.isError || !Number.isFinite(id) || id <= 0

  return (
    <PublicLayout showMainContainer={false}>
      <PageTransition>
        <div className='container px-4 pb-16 pt-24 md:px-6'>
          {/* 面包屑：既方便用户回退，也是内链结构 */}
          <nav
            aria-label={t('Breadcrumb')}
            className='mb-6 flex flex-wrap items-center gap-1 text-sm text-muted-foreground'
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
                <span className='line-clamp-1 text-foreground/80'>{item.title}</span>
              </>
            )}
          </nav>

          {isLoading ? (
            <div className='grid gap-6 md:grid-cols-[minmax(0,1.4fr)_minmax(360px,1fr)]'>
              <Skeleton className='aspect-video w-full rounded-2xl' />
              <div className='space-y-4'>
                <Skeleton className='h-8 w-2/3' />
                <Skeleton className='h-40 w-full' />
              </div>
            </div>
          ) : notFound || !item ? (
            <div className='py-24 text-center'>
              <h1 className='text-2xl font-semibold'>{t('Prompt not found')}</h1>
              <p className='mt-3 text-muted-foreground'>
                {t('This prompt may have been removed. Browse the gallery for more.')}
              </p>
              <Link
                to='/prompt-gallery'
                className='mt-6 inline-flex h-9 items-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90'
              >
                {t('Back to gallery')}
              </Link>
            </div>
          ) : (
            <div className='grid gap-6 md:grid-cols-[minmax(0,1.4fr)_minmax(360px,1fr)]'>
              {/* 左列：媒体 + 探索更多（黑底，与弹窗视觉一致） */}
              <div className='flex min-h-0 flex-col overflow-hidden rounded-2xl bg-black/95'>
                <div className='relative flex min-h-[280px] flex-1 items-center justify-center p-4 md:p-8'>
                  {current ? (
                    isVideoUrl(current) ? (
                      <video
                        key={current}
                        src={current}
                        controls
                        loop
                        muted
                        playsInline
                        poster={resolveImageUrl(item.cover)}
                        className='max-h-[70vh] w-full rounded-xl object-contain'
                      />
                    ) : (
                      <img
                        key={current}
                        src={current}
                        alt={item.title}
                        className='max-h-[70vh] w-full rounded-xl object-contain'
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

                <RecommendStrip
                  item={item}
                  onSelect={(nextId) => {
                    void navigate({
                      to: '/prompt-gallery/$id',
                      params: { id: String(nextId) },
                    })
                  }}
                />
              </div>

              {/* 右列：信息 + 双语提示词 + 操作 */}
              <div className='flex min-h-0 flex-col gap-5'>
                <div className='flex flex-wrap items-center gap-1.5'>
                  {item.model && (
                    <Badge className='rounded-full px-2.5'>{item.model}</Badge>
                  )}
                  <Badge variant='outline' className='rounded-full'>
                    {item.type === 'video' ? t('Video prompt') : t('Image prompt')}
                  </Badge>
                  {item.category && (
                    <Badge
                      variant='outline'
                      className='rounded-full text-muted-foreground'
                    >
                      {item.category}
                    </Badge>
                  )}
                </div>

                <div>
                  <h1 className='text-2xl font-semibold leading-snug tracking-tight md:text-3xl'>
                    {item.title}
                  </h1>
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
                      <Heart className='size-3.5' /> {likeCounts[item.id] ?? item.likes}
                    </span>
                  </div>
                </div>

                {tags.length > 0 && (
                  <div className='flex flex-wrap gap-1.5'>
                    {tags.map((tag) => (
                      <Link
                        key={tag}
                        to='/prompt-gallery'
                        search={{ tag }}
                        className='rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-foreground'
                      >
                        #{tag}
                      </Link>
                    ))}
                  </div>
                )}

                <PromptBlock item={item} />

                {/* 去创作：四种复用方式，由后台开关决定显示哪些 */}
                <CreateWithThis item={item} />

                <div className='mt-auto flex flex-wrap items-center gap-2 pt-2'>
                  <Button
                    variant={likedIds.has(item.id) ? 'default' : 'outline'}
                    size='sm'
                    className='gap-1.5 rounded-full'
                    onClick={handleLike}
                    disabled={likedIds.has(item.id)}
                  >
                    <Heart
                      className={cn(
                        'size-4',
                        likedIds.has(item.id) && 'fill-current'
                      )}
                    />
                    {likeCounts[item.id] ?? item.likes}
                  </Button>
                  <Button
                    variant={favorites.has(item.id) ? 'default' : 'outline'}
                    size='sm'
                    className='gap-1.5 rounded-full'
                    onClick={() => toggleFavorite(item.id)}
                  >
                    <Star
                      className={cn(
                        'size-4',
                        favorites.has(item.id) && 'fill-current'
                      )}
                    />
                    {favorites.has(item.id) ? t('Favorited') : t('Favorite')}
                  </Button>
                  <Button
                    variant='outline'
                    size='sm'
                    className='gap-1.5 rounded-full'
                    onClick={handleShare}
                  >
                    <Share2 className='size-4' />
                    {t('Share work')}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </PageTransition>
    </PublicLayout>
  )
}

export default PromptGalleryDetailPage
