import { useTranslation } from 'react-i18next'
import { Hash, Search, Shuffle } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

import type {
  PromptGalleryFacets,
  PromptGallerySort,
  PromptGalleryType,
} from '../types'

type FilterPanelProps = {
  facets?: PromptGalleryFacets
  category: string
  onCategoryChange: (category: string) => void
  type: PromptGalleryType | 'all'
  onTypeChange: (type: PromptGalleryType | 'all') => void
  search: string
  onSearchChange: (search: string) => void
  model: string
  onModelChange: (model: string) => void
  tag: string
  onTagChange: (tag: string) => void
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

const TYPES: { value: PromptGalleryType | 'all'; labelKey: string }[] = [
  { value: 'all', labelKey: 'All prompts' },
  { value: 'image', labelKey: 'Image prompts' },
  { value: 'video', labelKey: 'Video prompts' },
]

function chipClass(active: boolean) {
  return cn(
    'shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors',
    active
      ? 'bg-primary text-primary-foreground'
      : 'bg-muted text-muted-foreground hover:text-foreground'
  )
}

/** 筛选面板（对标参考站）：分类 tab / 搜索+类型 / 模型+排序+随机 / 标签 */
export function GalleryFilterPanel({
  facets,
  category,
  onCategoryChange,
  type,
  onTypeChange,
  search,
  onSearchChange,
  model,
  onModelChange,
  tag,
  onTagChange,
  sort,
  onSortChange,
  total,
  onRandom,
}: FilterPanelProps) {
  const { t } = useTranslation()

  const models = facets?.models ?? []
  const categories = facets?.categories ?? []
  const tags = facets?.tags ?? []

  return (
    <div className='mb-6 space-y-3.5 rounded-2xl border border-border bg-card p-4'>
      {/* 行 1：分类 tab（横向滚动） */}
      {categories.length > 0 && (
        <div className='-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'>
          <button
            type='button'
            onClick={() => onCategoryChange('')}
            className={chipClass(category === '')}
          >
            {t('All')}
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              type='button'
              onClick={() => onCategoryChange(cat)}
              className={chipClass(category === cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* 行 2：搜索 + 提示词类型 */}
      <div className='flex flex-wrap items-center gap-3'>
        <div className='relative min-w-[220px] flex-1'>
          <Search className='pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground' />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t('Search prompts, styles and ideas')}
            className='h-9 rounded-full pl-9'
          />
        </div>
        <div className='inline-flex rounded-full border border-border bg-muted p-0.5'>
          {TYPES.map(({ value, labelKey }) => (
            <button
              key={value}
              type='button'
              aria-pressed={type === value}
              onClick={() => onTypeChange(value)}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                type === value
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {t(labelKey)}
            </button>
          ))}
        </div>
      </div>

      {/* 行 3：模型 chips + 计数 + 排序 + 随机 */}
      <div className='flex flex-wrap items-center gap-2'>
        <div className='flex min-w-0 flex-1 flex-wrap gap-1.5'>
          <button
            type='button'
            onClick={() => onModelChange('')}
            className={chipClass(model === '')}
          >
            {t('All Models')}
          </button>
          {models.map((m) => (
            <button
              key={m}
              type='button'
              onClick={() => onModelChange(m)}
              className={chipClass(model === m)}
              title={m}
            >
              {m}
            </button>
          ))}
        </div>
        <div className='flex shrink-0 items-center gap-2'>
          {total !== undefined && (
            <span className='whitespace-nowrap text-xs text-muted-foreground'>
              {t('{{count}} prompts', { count: total })}
            </span>
          )}
          <div className='inline-flex gap-0.5'>
            {SORTS.map(({ value, labelKey }) => (
              <button
                key={value}
                type='button'
                aria-pressed={sort === value}
                onClick={() => onSortChange(value)}
                className={cn(
                  'rounded-md px-2 py-1 text-xs font-medium transition-colors',
                  sort === value
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {t(labelKey)}
              </button>
            ))}
          </div>
          {onRandom && (
            <button
              type='button'
              onClick={onRandom}
              aria-label={t('Random')}
              title={t('Random')}
              className='flex size-7 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:text-foreground'
            >
              <Shuffle className='size-3.5' />
            </button>
          )}
        </div>
      </div>

      {/* 行 4：标签 chips（横向滚动） */}
      {tags.length > 0 && (
        <div className='flex items-center gap-2'>
          <div className='-mx-1 flex min-w-0 flex-1 gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'>
            <button
              type='button'
              onClick={() => onTagChange('')}
              className={chipClass(tag === '')}
            >
              {t('All tags')}
            </button>
            {tags.map((tg) => (
              <button
                key={tg}
                type='button'
                onClick={() => onTagChange(tg)}
                className={chipClass(tag === tg)}
              >
                <Hash className='mr-0.5 inline size-3' />
                {tg}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
