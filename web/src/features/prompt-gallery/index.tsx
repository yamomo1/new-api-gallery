import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { FolderOpen, Plus, Share2, Sparkles, Star } from 'lucide-react'
import { toast } from 'sonner'

import { PublicLayout } from '@/components/layout'
import { PageTransition } from '@/components/page-transition'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'

import { GalleryCard, GalleryCardSkeleton, GalleryFilterPanel } from './components'
import {
  useLikePromptGallery,
  useMyPromptGalleryFavorites,
  usePromptGalleryFacets,
  usePromptGalleryList,
  useTogglePromptGalleryFavorite,
} from './hooks/use-prompt-gallery'
import type { PromptGalleryItem, PromptGallerySort, PromptGalleryType } from './types'
import { readFavorites, readLiked, writeFavorites, writeLiked, copyText } from './utils'

const PAGE_SIZE = 24

export function PromptGallery() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const search = useSearch({ from: '/prompt-gallery/' })
  const isLoggedIn = useAuthStore((state) => Boolean(state.auth.user))

  const [category, setCategory] = useState<string>(
    (search as { category?: string }).category || ''
  )
  const [type, setType] = useState<PromptGalleryType | 'all'>('all')
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [model, setModel] = useState('')
  const [tag, setTag] = useState<string>(
    (search as { tag?: string }).tag || ''
  )
  const [sort, setSort] = useState<PromptGallerySort>('related')
  const [offset, setOffset] = useState(0)
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [favorites, setFavorites] = useState<Set<number>>(() => readFavorites())
  const [likedIds, setLikedIds] = useState<Set<number>>(() => readLiked())
  const [likeCounts, setLikeCounts] = useState<Record<number, number>>({})

  // 搜索防抖
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query)
      setOffset(0)
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  // 筛选条件变化时回到第一页
  useEffect(() => {
    setOffset(0)
  }, [category, type, model, tag, sort])

  const facetsQuery = usePromptGalleryFacets()
  const listQuery = usePromptGalleryList({
    category: category || undefined,
    search: debouncedQuery || undefined,
    type: type === 'all' ? undefined : type,
    model: model || undefined,
    tag: tag || undefined,
    sort,
    offset,
    limit: PAGE_SIZE,
  })

  // 登录后收藏落库：画布「素材 → 已收藏」读的就是这份数据
  const favoritesQuery = useMyPromptGalleryFavorites(isLoggedIn)
  const favoriteMutation = useTogglePromptGalleryFavorite()
  const syncedRef = useRef(false)

  // 首次登录时把本地收藏合并到服务端（老用户不丢收藏）
  useEffect(() => {
    if (!isLoggedIn || !favoritesQuery.isSuccess || syncedRef.current) return
    syncedRef.current = true
    const serverIds = new Set(favoritesQuery.data?.ids ?? [])
    const missing = [...readFavorites()].filter((id) => !serverIds.has(id))
    if (missing.length) missing.forEach((id) => favoriteMutation.mutate(id))
    writeFavorites(new Set())
  }, [isLoggedIn, favoritesQuery.isSuccess, favoritesQuery.data, favoriteMutation])

  // 服务端收藏为准（登录后）
  useEffect(() => {
    const ids = favoritesQuery.data?.ids
    if (!isLoggedIn || !ids) return
    setFavorites(new Set(ids))
  }, [isLoggedIn, favoritesQuery.data])

  const allItems = listQuery.data?.items ?? []
  const items = useMemo(() => {
    if (!favoritesOnly) return allItems
    // 登录后：收藏视图直接展示服务端收藏全集，不受当前页/筛选限制
    if (isLoggedIn && favoritesQuery.data) return favoritesQuery.data.items
    return allItems.filter((i) => favorites.has(i.id))
  }, [allItems, favoritesOnly, favorites, isLoggedIn, favoritesQuery.data])
  const total = listQuery.data?.total

  const likeMutation = useLikePromptGallery()

  const handleLike = useCallback(
    (item: PromptGalleryItem) => {
      if (likedIds.has(item.id)) return
      likeMutation.mutate(item.id, {
        onSuccess: (data) => {
          setLikeCounts((prev) => ({ ...prev, [item.id]: data.likes }))
          const next = new Set(likedIds)
          next.add(item.id)
          setLikedIds(next)
          writeLiked(next)
        },
      })
    },
    [likedIds, likeMutation]
  )

  const toggleFavorite = useCallback(
    (id: number) => {
      setFavorites((prev) => {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        if (!isLoggedIn) writeFavorites(next)
        return next
      })
      if (isLoggedIn) favoriteMutation.mutate(id)
    },
    [favoriteMutation, isLoggedIn]
  )

  const handleCopy = useCallback(
    async (prompt: string) => {
      const ok = await copyText(prompt)
      if (ok) toast.success(t('Prompt copied'))
      else toast.error(t('Copy failed'))
    },
    [t]
  )

  const handleRandom = useCallback(() => {
    if (total) {
      setOffset(Math.floor(Math.random() * Math.max(total - PAGE_SIZE, 1)))
    }
  }, [total])

  const handleShare = useCallback(async () => {
    const ok = await copyText(window.location.href)
    if (ok) toast.success(t('Link copied'))
    else toast.error(t('Copy failed'))
  }, [t])

  // 单个作品分享：移动端走系统分享面板，桌面端复制直达链接
  const handleShareItem = useCallback(
    async (item: PromptGalleryItem) => {
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
    },
    [t]
  )

  // 旧版深链兼容：/prompt-gallery?prompt=123 → /prompt-gallery/123
  // 详情已改成真路由（独立 URL 才能被搜索引擎收录），老分享链接不能断。
  const promptParam = (search as { prompt?: number }).prompt
  useEffect(() => {
    if (typeof promptParam === 'number' && Number.isFinite(promptParam) && promptParam > 0) {
      navigate({
        to: '/prompt-gallery/$id',
        params: { id: String(promptParam) },
        replace: true,
      })
    }
  }, [promptParam, navigate])

  // 打开作品详情：走路由跳转，而不是弹窗
  const openDetail = useCallback(
    (item: PromptGalleryItem) => {
      void navigate({
        to: '/prompt-gallery/$id',
        params: { id: String(item.id) },
      })
    },
    [navigate]
  )

  const isLoading = listQuery.isLoading && allItems.length === 0

  return (
    <PublicLayout showMainContainer={false}>
      <PageTransition>
        <div className='container px-4 pb-16 pt-24 md:px-6'>
          {/* 页头（对标参考站：徽标 + 标题 + 副标题 + 操作按钮组） */}
          <div className='mb-10 flex flex-wrap items-end justify-between gap-6'>
            <div>
              <p className='inline-flex items-center gap-1.5 text-sm font-semibold tracking-wide text-primary'>
                <Sparkles className='size-4' />
                {t('Featured AI prompt inspiration')}
              </p>
              <h1 className='mt-2 text-4xl font-semibold tracking-tight md:text-5xl'>
                {t('Prompt Gallery')}
              </h1>
              <p className='mt-3 max-w-2xl text-[15px] leading-relaxed text-muted-foreground'>
                {t(
                  'Browse curated image and video prompts, and send any inspiration straight to the generator.'
                )}
              </p>
            </div>
            <div className='flex flex-wrap items-center gap-2'>
              <Button
                onClick={() => navigate({ to: '/my-works', search: { create: true } })}
              >
                <Plus className='size-4' /> {t('Publish work')}
              </Button>
              <Button variant='outline' onClick={() => navigate({ to: '/my-works' })}>
                <FolderOpen className='size-4' /> {t('My works')}
              </Button>
              <Button variant='ghost' onClick={handleShare}>
                <Share2 className='size-4' /> {t('Share gallery')}
              </Button>
              <Button
                variant={favoritesOnly ? 'default' : 'ghost'}
                onClick={() => setFavoritesOnly((v) => !v)}
                title={t('Show favorites only')}
              >
                <Star className={cn('size-4', favoritesOnly && 'fill-current')} />
                {t('Favorites')}
              </Button>
            </div>
          </div>

          <GalleryFilterPanel
            facets={facetsQuery.data}
            category={category}
            onCategoryChange={setCategory}
            type={type}
            onTypeChange={setType}
            search={query}
            onSearchChange={setQuery}
            model={model}
            onModelChange={setModel}
            tag={tag}
            onTagChange={setTag}
            sort={sort}
            onSortChange={setSort}
            total={total}
            onRandom={handleRandom}
          />

          {/* 瀑布流 */}
          <div className='columns-2 gap-6 md:columns-3 xl:columns-4'>
            {isLoading
              ? Array.from({ length: 8 }).map((_, i) => <GalleryCardSkeleton key={i} />)
              : items.map((item, i) => (
                  <GalleryCard
                    key={item.id}
                    item={item}
                    index={i}
                    onOpen={openDetail}
                    liked={likedIds.has(item.id)}
                    likeCount={likeCounts[item.id]}
                    onLike={handleLike}
                    favorite={favorites.has(item.id)}
                    onToggleFavorite={toggleFavorite}
                    onCopy={handleCopy}
                    onShare={handleShareItem}
                  />
                ))}
          </div>

          {!isLoading && items.length === 0 && (
            <div className='py-24 text-center text-muted-foreground'>
              {favoritesOnly && favorites.size === 0
                ? t('No favorites yet')
                : t('No prompts yet')}
            </div>
          )}

          {/* 加载更多 */}
          {!favoritesOnly && total !== undefined && offset + PAGE_SIZE < total && (
            <div className='mt-10 flex justify-center'>
              <button
                type='button'
                className='rounded-full border border-border px-6 py-2.5 text-sm text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground'
                onClick={() => setOffset((v) => v + PAGE_SIZE)}
              >
                {t('Load more')}
              </button>
            </div>
          )}
        </div>
      </PageTransition>
    </PublicLayout>
  )
}

export default PromptGallery
