/*
 * 风格模型选择弹窗（点开「风格模型」上传位弹出）
 *
 * 对齐 liblib 的素材库弹窗：
 * - 顶部 Tab：广场 / 我的收藏 / 最近使用 + 搜索框
 * - 分类 chips（全部 / 画廊分类…）
 * - 8 列瀑布式网格，卡片 = 画廊封面 + 类型角标 + 标题，选中蓝框
 * - 点缩略图即选中/取消（无确认按钮），最多 3 个，超出自动替换最早选中的
 * 数据来源：画廊 `/api/prompt-gallery/v1/prompts`（广场）、`/favorites`（我的收藏）、
 * 本地 localStorage（最近使用）。
 */
import { ArrowDownUp, Check, Heart, Search, X } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'

import { YmmDropdown } from '@/components/ui/ymm-dropdown'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  getMyPromptGalleryFavorites,
  getPromptGalleryFacets,
  getPromptGalleryList,
} from '@/features/prompt-gallery/api'
import type { PromptGalleryItem } from '@/features/prompt-gallery/types'
import { useModelsByCategory } from '@/hooks/use-model-catalog'
import { resolveImageUrl } from '@/lib/storage'

const RECENT_KEY = 'ymm:style-picker:recent'

type TabKey = 'square' | 'fav' | 'recent'

function readRecent(): PromptGalleryItem[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    return raw ? (JSON.parse(raw) as PromptGalleryItem[]) : []
  } catch {
    return []
  }
}

function pushRecent(items: PromptGalleryItem[]) {
  try {
    const merged = [...items, ...readRecent()]
    const uniq: PromptGalleryItem[] = []
    const seen = new Set<number>()
    for (const it of merged) {
      if (seen.has(it.id)) continue
      seen.add(it.id)
      uniq.push(it)
      if (uniq.length >= 24) break
    }
    localStorage.setItem(RECENT_KEY, JSON.stringify(uniq))
  } catch {
    /* 忽略隐私模式写入失败 */
  }
}

export function StylePickerDialog({
  open,
  onOpenChange,
  selectedItems = [],
  onToggle,
  replacingIndex = null,
  onReplace,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  /** 已选中的素材（受控，父级持有状态） */
  selectedItems?: PromptGalleryItem[]
  /** 点缩略图即切换选择（无确认按钮） */
  onToggle: (item: PromptGalleryItem) => void
  /** 替换模式：非空表示正在替换第 N 个已选槽位（点任意卡片 = 替换它） */
  replacingIndex?: number | null
  /** 替换模式下选中某张卡片 */
  onReplace?: (item: PromptGalleryItem) => void
}) {
  const [tab, setTab] = useState<TabKey>('square')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [sort, setSort] = useState<'recommend' | 'latest'>('recommend')
  /** 模型筛选：'' = 全部；否则按模型名过滤 */
  const [modelFilter, setModelFilter] = useState('')
  const imageModels = useModelsByCategory('image')
  const selected = selectedItems

  const facetsQuery = useQuery({
    queryKey: ['style-picker-facets'],
    queryFn: getPromptGalleryFacets,
    staleTime: 5 * 60 * 1000,
    enabled: open,
  })

  const listQuery = useQuery({
    queryKey: ['style-picker-list', category, search, modelFilter],
    queryFn: () =>
      getPromptGalleryList({
        offset: 0,
        limit: 48,
        ...(category ? { category } : {}),
        ...(search ? { search } : {}),
        ...(modelFilter ? { model: modelFilter } : {}),
      }),
    enabled: open && tab === 'square',
    staleTime: 60 * 1000,
  })

  const favQuery = useQuery({
    queryKey: ['style-picker-fav'],
    queryFn: () => getMyPromptGalleryFavorites({ offset: 0, limit: 48 }),
    enabled: open && tab === 'fav',
    retry: false,
  })

  const items = useMemo<PromptGalleryItem[]>(() => {
    let list: PromptGalleryItem[]
    if (tab === 'recent') list = readRecent()
    else if (tab === 'fav') list = favQuery.data?.data?.items ?? []
    else {
      const raw = listQuery.data?.data?.items ?? []
      const kw = search.trim().toLowerCase()
      const byModel = modelFilter
        ? raw.filter((it) => (it.model ?? '').includes(modelFilter))
        : raw
      list = kw
        ? byModel.filter((it) =>
            `${it.title} ${it.model} ${it.tags}`.toLowerCase().includes(kw)
          )
        : byModel
    }
    // 本地排序：推荐 = 接口默认顺序；最新 = 按 id 倒序
    return sort === 'latest' ? [...list].sort((a, b) => b.id - a.id) : list
  }, [tab, favQuery.data, listQuery.data, search, sort, modelFilter])

  const categories = useMemo(() => {
    const fromFacets = facetsQuery.data?.data?.categories ?? []
    return ['全部', ...fromFacets]
  }, [facetsQuery.data])

  const loading = tab === 'square' ? listQuery.isLoading : tab === 'fav' ? favQuery.isLoading : false

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className='dark:bg-card flex h-[min(760px,80vh)] w-[min(1560px,92vw)] max-w-[calc(100vw-32px)] flex-col gap-0 overflow-hidden rounded-2xl border-0 bg-white p-0 shadow-[0_12px_48px_rgba(0,0,0,0.16)] sm:max-w-[min(1560px,92vw)]'
        showCloseButton={false}
      >
        <DialogTitle className='sr-only'>选择风格模型</DialogTitle>

        {/* 顶部：Tab + 搜索 + 关闭 */}
        <div className='flex items-center gap-6 px-6 pt-5 pb-3'>
          <div className='flex items-center gap-4'>
            {([
              { key: 'square', label: '广场' },
              { key: 'fav', label: '我的收藏' },
              { key: 'recent', label: '最近使用' },
            ] as const).map((t) => (
              <button
                key={t.key}
                type='button'
                onClick={() => setTab(t.key)}
                className={`relative h-8 text-[15px] transition-colors ${
                  tab === t.key
                    ? 'text-foreground font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t.label}
                {tab === t.key && (
                  <span className='bg-foreground absolute inset-x-0 -bottom-0.5 h-0.5 rounded-full' />
                )}
              </button>
            ))}
          </div>

          <div className='relative ml-2 h-9 flex-1 max-w-[360px]'>
            <Search className='text-muted-foreground/70 pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2' />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder='输入模型名称、作者、标签搜索'
              className='bg-muted/60 placeholder:text-muted-foreground/70 text-foreground h-9 w-full rounded-lg pr-3 pl-9 text-[13px] outline-none'
            />
          </div>

          <span className='text-muted-foreground ml-auto text-[13px] tabular-nums'>
            {replacingIndex !== null
              ? `点任意素材替换第 ${replacingIndex + 1} 个`
              : `已选 ${selected.length}/3`}
          </span>

          <button
            type='button'
            onClick={() => onOpenChange(false)}
            className='text-muted-foreground hover:text-foreground flex size-8 items-center justify-center rounded-lg'
            aria-label='关闭'
          >
            <X className='size-4.5' />
          </button>
        </div>

        {/* 分类 + 模型筛选 + 排序 */}
        <div className='flex flex-wrap items-center gap-x-2 gap-y-2 px-6 pb-4'>
          <div className='flex min-w-0 flex-1 flex-wrap items-center gap-2'>
          {categories.map((c) => {
            const value = c === '全部' ? '' : c
            const active = category === value
            return (
              <button
                key={c}
                type='button'
                onClick={() => setCategory(value)}
                className={`h-7 shrink-0 rounded-md px-2.5 text-[13px] transition-colors ${
                  active
                    ? 'bg-foreground text-background font-medium'
                    : 'text-muted-foreground hover:bg-foreground/5'
                }`}
              >
                {c}
              </button>
            )
          })}
          </div>
          <div className='ml-auto flex shrink-0 items-center gap-2'>
          <YmmDropdown
            className='shrink-0'
            scroll
            value={modelFilter}
            onChange={setModelFilter}
            ariaLabel='按模型筛选'
            options={[
              { value: '', label: '全部' },
              ...(facetsQuery.data?.data?.models?.length
                ? facetsQuery.data.data.models
                : imageModels.map((m) => m.name)
              ).map((name) => ({ value: name, label: name })),
            ]}
          />
          <button
            type='button'
            onClick={() => setSort(sort === 'recommend' ? 'latest' : 'recommend')}
            className='text-muted-foreground hover:text-foreground flex h-[34px] shrink-0 items-center gap-1 rounded-[10px] px-2.5 text-[13px] transition-colors'
          >
            <ArrowDownUp className='size-3.5' />
            {sort === 'recommend' ? '推荐' : '最新'}
          </button>
          </div>
        </div>

        {/* 网格 */}
        <div className='min-h-0 flex-1 overflow-y-auto px-6 pb-6'>
          {loading ? (
            <div className='text-muted-foreground py-16 text-center text-sm'>加载中…</div>
          ) : items.length === 0 ? (
            <div className='text-muted-foreground py-16 text-center text-sm'>
              {tab === 'fav' ? '还没有收藏作品，去广场看看' : '暂无素材'}
            </div>
          ) : (
            <div className='grid grid-cols-4 items-start gap-x-5 gap-y-6 sm:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8'>
              {items.map((item) => {
                // 种子作品封面是 data: URI，resolveImageUrl 只管站内相对路径，
                // 这里对 data:/http(s) 直通，其余再走存储地址解析
                const rawCover = item.cover ?? ''
                const cover = /^(data:|https?:)/i.test(rawCover)
                  ? rawCover
                  : resolveImageUrl(rawCover)
                const isSelected = selected.some((s) => s.id === item.id)
                return (
                  <button
                    key={item.id}
                    type='button'
                    onClick={() => {
                      pushRecent([item])
                      // 替换模式：直接换掉目标槽位的内容
                      if (replacingIndex !== null && onReplace) {
                        onReplace(item)
                        return
                      }
                      // 已选 → 取消并留在弹窗里继续换；新选 → 应用并关闭
                      if (isSelected) {
                        onToggle(item)
                        return
                      }
                      onToggle(item)
                      onOpenChange(false)
                    }}
                    className={`group relative aspect-[3/4] overflow-hidden rounded-lg bg-muted text-left ring-offset-2 transition-all ${
                      isSelected
                        ? 'ring-primary ring-[3px]'
                        : 'hover:ring-foreground/20 hover:ring-2'
                    }`}
                  >
                    {cover ? (
                      <img
                        src={cover}
                        alt={item.title}
                        loading='lazy'
                        className='size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]'
                      />
                    ) : (
                      <span className='bg-muted block size-full' />
                    )}

                    <span className='absolute top-1.5 left-1.5 rounded-[4px] bg-black/45 px-1 py-0.5 text-[9px] font-medium text-white backdrop-blur-sm'>
                      风格模型
                    </span>

                    {isSelected && (
                      <span className='absolute top-1.5 right-1.5 flex size-5 items-center justify-center rounded-full bg-primary text-white'>
                        <Check className='size-3' />
                      </span>
                    )}

                    <span className='absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent px-1.5 pt-5 pb-1.5'>
                      <span className='line-clamp-1 text-[11px] font-medium text-white/95'>
                        {item.title}
                      </span>
                    </span>

                    {!isSelected && (
                      <span className='absolute top-1.5 right-1.5 flex size-6 items-center justify-center rounded-md bg-white/85 text-foreground opacity-0 transition-opacity group-hover:opacity-100'>
                        <Heart className='size-3' />
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>

      </DialogContent>
    </Dialog>
  )
}
