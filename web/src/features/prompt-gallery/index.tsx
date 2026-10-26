import { useCallback, useState } from 'react'
import { useSearch } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { PublicLayout } from '@/components/layout'
import { PageTransition } from '@/components/page-transition'

import { GalleryCard, GalleryCardSkeleton, GalleryFilterPanel } from './components'
import {
  usePromptGalleryFacets,
  usePromptGalleryList,
} from './hooks/use-prompt-gallery'
import type { PromptGallerySort, PromptGalleryType } from './types'

const PAGE_SIZE = 24

export function PromptGallery() {
  const { t } = useTranslation()
  const search = useSearch({ from: '/prompt-gallery/' })

  const [type, setType] = useState<PromptGalleryType | 'all'>('all')
  const [query, setQuery] = useState('')
  const [model, setModel] = useState('')
  const [sort, setSort] = useState<PromptGallerySort>('related')
  const [offset, setOffset] = useState(0)

  const facetsQuery = usePromptGalleryFacets()
  const listQuery = usePromptGalleryList({
    category: (search as { category?: string }).category,
    search: query || undefined,
    type: type === 'all' ? undefined : type,
    model: model || undefined,
    sort,
    offset,
    limit: PAGE_SIZE,
  })

  const items = listQuery.data?.items ?? []
  const total = listQuery.data?.total

  const handleCopy = useCallback(
    (prompt: string) => {
      navigator.clipboard?.writeText(prompt)
      toast.success(t('Prompt copied'))
    },
    [t]
  )

  const handleRandom = useCallback(() => {
    if (total) {
      setOffset(Math.floor(Math.random() * Math.max(total, PAGE_SIZE)))
    }
  }, [total])

  const isLoading = listQuery.isLoading && items.length === 0

  return (
    <PublicLayout showMainContainer={false}>
      <PageTransition>
        <div className='container px-4 py-6 pt-20 md:px-6'>
          {/* 页头 */}
          <div className='mb-6 flex flex-wrap items-end justify-between gap-4'>
            <div>
              <p className='text-sm font-semibold uppercase tracking-widest text-primary'>
                {t('Prompt Gallery')}
              </p>
              <h1 className='mt-1 text-3xl font-bold tracking-tight md:text-4xl'>
                {t('Get inspired by the community')}
              </h1>
              <p className='mt-2 text-muted-foreground'>
                {t('Browse, copy and remix prompts for images and videos.')}
              </p>
            </div>
          </div>

          <GalleryFilterPanel
            facets={facetsQuery.data}
            type={type}
            onTypeChange={setType}
            search={query}
            onSearchChange={setQuery}
            model={model}
            onModelChange={setModel}
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
                  <GalleryCard key={item.id} item={item} onCopy={handleCopy} />
                ))}
          </div>

          {!isLoading && items.length === 0 && (
            <div className='py-20 text-center text-muted-foreground'>
              {t('No prompts yet')}
            </div>
          )}

          {/* 加载更多 */}
          {total !== undefined && offset + PAGE_SIZE < total && (
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
      </PageTransition>
    </PublicLayout>
  )
}

export default PromptGallery
