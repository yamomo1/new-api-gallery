import { useTranslation } from 'react-i18next'
import { Search, Shuffle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

import type {
  PromptGalleryFacets,
  PromptGallerySort,
  PromptGalleryType,
} from '../types'

type FilterPanelProps = {
  facets?: PromptGalleryFacets
  type: PromptGalleryType | 'all'
  onTypeChange: (type: PromptGalleryType | 'all') => void
  search: string
  onSearchChange: (search: string) => void
  model: string
  onModelChange: (model: string) => void
  sort: PromptGallerySort
  onSortChange: (sort: PromptGallerySort) => void
  total?: number
  onRandom?: () => void
}

const SORTS: { value: PromptGallerySort; labelKey: string }[] = [
  { value: 'related', labelKey: 'Related' },
  { value: 'latest', labelKey: 'Latest' },
  { value: 'featured', labelKey: 'Featured' },
  { value: 'popular', labelKey: 'Popular' },
]

export function GalleryFilterPanel({
  facets,
  type,
  onTypeChange,
  search,
  onSearchChange,
  model,
  onModelChange,
  sort,
  onSortChange,
  total,
  onRandom,
}: FilterPanelProps) {
  const { t } = useTranslation()

  const models = facets?.models ?? []
  const categories = facets?.categories ?? []

  return (
    <div className='mb-6 space-y-4 rounded-2xl border border-border bg-card p-4'>
      {/* 类型 Tab + 搜索 */}
      <div className='flex flex-wrap items-center gap-3'>
        <div className='inline-flex rounded-full border border-border bg-muted p-1'>
          {(
            [
              ['all', t('All')],
              ['image', t('Image')],
              ['video', t('Video')],
            ] as [PromptGalleryType | 'all', string][]
          ).map(([value, label]) => (
            <button
              key={value}
              type='button'
              aria-pressed={type === value}
              onClick={() => onTypeChange(value)}
              className={cn(
                'rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors',
                type === value
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className='relative min-w-[200px] flex-1'>
          <Search className='pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground' />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t('Search prompts, models…')}
            className='h-9 rounded-full pl-9'
          />
        </div>

        <div className='flex items-center gap-2'>
          {total !== undefined && (
            <span className='rounded-full border border-border bg-muted px-2.5 py-1 text-xs text-muted-foreground'>
              {total} {t('items')}
            </span>
          )}
          {onRandom && (
            <Button
              variant='outline'
              size='icon-sm'
              onClick={onRandom}
              aria-label={t('Random')}
              title={t('Random')}
            >
              <Shuffle className='size-3.5' />
            </Button>
          )}
        </div>
      </div>

      {/* 模型 chip */}
      {models.length > 0 && (
        <div className='flex flex-wrap gap-1.5'>
          <button
            type='button'
            onClick={() => onModelChange('')}
            className={cn(
              'rounded-full px-3 py-1 text-xs transition-colors',
              model === ''
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            )}
          >
            {t('All Models')}
          </button>
          {models.map((m) => (
            <button
              key={m}
              type='button'
              onClick={() => onModelChange(m)}
              className={cn(
                'rounded-full px-3 py-1 text-xs transition-colors',
                model === m
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              )}
            >
              {m}
            </button>
          ))}
        </div>
      )}

      {/* 分类标签 + 排序 */}
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div className='flex flex-wrap gap-1.5'>
          {categories.map((cat) => (
            <button
              key={cat}
              type='button'
              onClick={() => onModelChange('')}
              className='rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground'
            >
              {cat}
            </button>
          ))}
        </div>

        <div className='inline-flex gap-0.5'>
          {SORTS.map(({ value, labelKey }) => (
            <button
              key={value}
              type='button'
              aria-pressed={sort === value}
              onClick={() => onSortChange(value)}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                sort === value
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {t(labelKey)}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
