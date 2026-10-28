import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { FolderOpen, Plus, Share2, Sparkles, Star } from 'lucide-react'
import { toast } from 'sonner'

import { PublicLayout } from '@/components/layout'
import { PageTransition } from '@/components/page-transition'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import { GalleryCard, GalleryCardSkeleton, GalleryFilterPanel } from './components'
import { GalleryDetailDialog } from './components/gallery-detail-dialog'
import {
  useLikePromptGallery,
  usePromptGalleryFacets,
  usePromptGalleryList,
} from './hooks/use-prompt-gallery'
import type { PromptGalleryItem, PromptGallerySort, PromptGalleryType } from './types'
import { readFavorites, readLiked, writeFavorites, writeLiked } from './utils'

const PAGE_SIZE = 24

export function PromptGallery() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const search = useSearch({ from: '/prompt-gallery/' })

  const [category, setCategory] = useState<string>(
    (search as { category?: string }).category || ''
  )
  const [type, setType] = useState<PromptGalleryType | 'all'>('all')
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [model, setModel] = useState('')
  const [tag, setTag] = useState('')
  const [sort, setSort] = useState<PromptGallerySort>('related')
  const [offset, setOffset] = useState(0)
  const [detail, setDetail] = useState<{ id: number; item: PromptGalleryItem } | null>(
    null
  )
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

  const allItems = listQuery.data?.items ?? []
  const items = useMemo(
    () => (favoritesOnly ? allItems.filter((i) => favorites.has(i.id)) : allItems),
    [allItems, favoritesOnly, favorites]
  )
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

  const toggleFavorite = useCallback((id: number) => {
    setFavorites((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      writeFavorites(next)
      return next
    })
  }, [])

  const handleCopy = useCallback(
    (prompt: string) => {
      navigator.clipboard?.writeText(prompt)
      toast.success(t('Prompt copied'))
    },
    [t]
  )

  const handleRandom = useCallback(() => {
    if (total) {
      setOffset(Math.floor(Math.random() * Math.max(total - PAGE_SIZE, 1)))
    }
  }, [total])

  const handleShare = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      toast.success(t('Link copied'))
    } catch {
      toast.error(t('Copy failed'))
    }
  }, [t])

  const isLoading = listQuery.isLoading && allItems.length === 0

  return (
    <PublicLayout showMainContainer={false}>
      <PageTransition>
        <div className='container px-4 py-6 pt-20 md:px-6'>
          {/* 页头（对标参考站：徽标 + 标题 + 副标题 + 操作按钮组） */}
          <div className='mb-6 flex flex-wrap items-end justify-between gap-4'>
            <div>
              <p className='inline-flex items-center gap-1.5 text-sm font-semibold tracking-wide text-primary'>
                <Sparkles className='size-4' />
                {t('Featured AI prompt inspiration')}
              </p>
              <h1 className='mt-1 text-3xl font-bold tracking-tight md:text-4xl'>
                {t('Prompt Gallery')}
              </h1>
              <p className='mt-2 text-muted-foreground'>
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
              <Button
                variant='outline'
                onClick={() => navigate({ to: '/my-works' })}
              >
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
          <div className='columns-2 gap-4 sm:columns-3 lg:columns-4'>
            {isLoading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <GalleryCardSkeleton key={i} />
                ))
              : items.map((item) => (
                  <GalleryCard
                    key={item.id}
                    item={item}
                    onOpen={(it) => setDetail({ id: it.id, item: it })}
                    liked={likedIds.has(item.id)}
                    likeCount={likeCounts[item.id]}
                    onLike={handleLike}
                    favorite={favorites.has(item.id)}
                    onToggleFavorite={toggleFavorite}
                    onCopy={handleCopy}
                  />
                ))}
          </div>

          {!isLoading && items.length === 0 && (
            <div className='py-20 text-center text-muted-foreground'>
              {favoritesOnly && favorites.size === 0
                ? t('No favorites yet')
                : t('No prompts yet')}
            </div>
          )}

          {/* 加载更多 */}
          {!favoritesOnly && total !== undefined && offset + PAGE_SIZE < total && (
            <div className='mt-6 flex justify-center'>
              <button
                type='button'
                className='rounded-full border border-border px-5 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground'
                onClick={() => setOffset((v) => v + PAGE_SIZE)}
              >
                {t('Load more')}
              </button>
            </div>
          )}
        </div>

        {/* 详情弹窗 */}
        <GalleryDetailDialog
          id={detail?.id ?? null}
          fallback={detail?.item ?? null}
          onClose={() => setDetail(null)}
          liked={detail ? likedIds.has(detail.id) : false}
          likeCount={detail ? likeCounts[detail.id] : undefined}
          onLike={handleLike}
          favorite={detail ? favorites.has(detail.id) : false}
          onToggleFavorite={toggleFavorite}
        />
      </PageTransition>
    </PublicLayout>
  )
}

export default PromptGallery
