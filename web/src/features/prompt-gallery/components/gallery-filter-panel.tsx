import { useTranslation } from 'react-i18next'
import { Hash, Search, Shuffle } from 'lucide-react'
import { motion } from 'motion/react'

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

/** 行滚动容器：横向滚动 + 两端渐隐遮罩 */
function ChipRow({ children }: { children: React.ReactNode }) {
  return (
    <div
      className='-mx-1 flex gap-2 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
      style={{
        maskImage:
          'linear-gradient(to right, transparent, black 12px, black calc(100% - 24px), transparent)',
      }}
    >
      {children}
    </div>
  )
}

const chipBase =
  'shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] font-medium outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-ring'

/** 未选中 chip：幽灵态，hover 浮起 */
function ghostChip(active: boolean) {
  return cn(
    chipBase,
    'active:scale-95',
    active
      ? 'bg-foreground text-background shadow-sm'
      : 'border border-transparent text-muted-foreground hover:border-border hover:bg-muted hover:text-foreground'
  )
}

/** 筛选面板（对标参考站）：分类 / 搜索+类型+排序 / 模型 / 标签，带入场与滑动指示动效 */
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
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className='mb-10 space-y-5 rounded-[24px] border border-border/70 bg-card/70 px-4 py-5 shadow-sm backdrop-blur-sm md:px-6 md:py-6'
    >
      {/* 行 1：分类 tab（滑动指示 pill） */}
      {categories.length > 0 && (
        <ChipRow>
          {[{ key: '', label: t('All') }, ...categories.map((c) => ({ key: c, label: c }))].map(
            ({ key, label }) => {
              const active = category === key
              return (
                <button
                  key={key || '__all__'}
                  type='button'
                  aria-pressed={active}
                  onClick={() => onCategoryChange(key)}
                  className={cn(
                    'relative shrink-0 whitespace-nowrap rounded-full px-4 py-1.5 text-[13px] font-medium outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-ring',
                    active ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId='gallery-category-pill'
                      className='absolute inset-0 rounded-full bg-primary shadow-sm'
                      transition={{ type: 'spring', bounce: 0.15, duration: 0.4 }}
                    />
                  )}
                  <span className='relative'>{label}</span>
                </button>
              )
            }
          )}
        </ChipRow>
      )}

      {categories.length > 0 && <div className='h-px bg-border/60' />}

      {/* 行 2：搜索 + 类型 + 右侧计数/排序/随机 */}
      <div className='flex flex-wrap items-center gap-x-3 gap-y-3'>
        <div className='relative w-[220px] max-w-full sm:w-[260px]'>
          <Search className='pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground' />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t('Search prompts, styles and ideas')}
            className='h-9 rounded-full border-transparent bg-muted/60 pl-9 text-[13px] shadow-none transition-colors focus-visible:border-border focus-visible:bg-background'
          />
        </div>

        <div className='inline-flex rounded-full bg-muted/60 p-0.5'>
          {TYPES.map(({ value, labelKey }) => {
            const active = type === value
            return (
              <button
                key={value}
                type='button'
                aria-pressed={active}
                onClick={() => onTypeChange(value)}
                className={cn(
                  'relative whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors',
                  active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {active && (
                  <motion.span
                    layoutId='gallery-type-pill'
                    className='absolute inset-0 rounded-full bg-background shadow-sm'
                    transition={{ type: 'spring', bounce: 0.15, duration: 0.4 }}
                  />
                )}
                <span className='relative'>{t(labelKey)}</span>
              </button>
            )
          })}
        </div>

        <div className='ml-auto flex flex-wrap items-center gap-3'>
          {total !== undefined && (
            <span className='whitespace-nowrap text-[13px] tabular-nums text-muted-foreground'>
              {t('{{count}} prompts', { count: total })}
            </span>
          )}
          <div className='inline-flex items-center gap-0.5'>
            {SORTS.map(({ value, labelKey }) => (
              <button
                key={value}
                type='button'
                aria-pressed={sort === value}
                onClick={() => onSortChange(value)}
                className={cn(
                  'whitespace-nowrap rounded-full px-2.5 py-1 text-[13px] font-medium transition-colors',
                  sort === value
                    ? 'bg-foreground/10 text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {t(labelKey)}
              </button>
            ))}
          </div>
          {onRandom && (
            <motion.button
              type='button'
              onClick={onRandom}
              aria-label={t('Random')}
              title={t('Random')}
              whileTap={{ scale: 0.9, rotate: -12 }}
              className='flex size-8 items-center justify-center rounded-full border border-border/80 text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground'
            >
              <Shuffle className='size-3.5' />
            </motion.button>
          )}
        </div>
      </div>

      {/* 行 3：模型 chips */}
      {models.length > 0 && (
        <ChipRow>
          <button
            type='button'
            onClick={() => onModelChange('')}
            className={ghostChip(model === '')}
          >
            {t('All Models')}
          </button>
          {models.map((m) => (
            <button
              key={m}
              type='button'
              onClick={() => onModelChange(m)}
              className={cn(ghostChip(model === m), 'text-xs')}
              title={m}
            >
              {m}
            </button>
          ))}
        </ChipRow>
      )}

      {/* 行 4：标签 chips */}
      {tags.length > 0 && (
        <ChipRow>
          <span className='shrink-0 text-[13px] text-muted-foreground/70'>
            {t('Tags')}
          </span>
          <button
            type='button'
            onClick={() => onTagChange('')}
            className={cn(ghostChip(tag === ''), 'text-xs')}
          >
            {t('All tags')}
          </button>
          {tags.map((tg) => (
            <button
              key={tg}
              type='button'
              onClick={() => onTagChange(tg)}
              className={cn(ghostChip(tag === tg), 'text-xs')}
            >
              <Hash className='mr-0.5 inline size-3' />
              {tg}
            </button>
          ))}
        </ChipRow>
      )}
    </motion.div>
  )
}
