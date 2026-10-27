/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

/**
 * 首页 03 灵感画廊作品编辑器（首页设置 → 灵感画廊）
 * ------------------------------------------------------------------
 * 两件事：
 * 1) 来源选择——手动挑选 / 画廊最新 / 画廊最热门（写 shared.gallery.source）
 *    - manual：完全按下面这份列表渲染，改图改标题都以手选为准
 *    - latest / popular：首页直接拉取画廊已发布作品，手选列表不生效
 * 2) 手选列表编辑——可以从提示词画廊里挑作品（图片或视频自动带过来），
 *    也可以手动改封面地址 / 悬停视频地址 / 标题。
 *
 * 数据存放在 shared.gallery.*（跨语种共用，数组整体替换）。
 */
import { ArrowDown, ArrowUp, Images, Loader2, Plus, RotateCcw, Trash2, Video } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog } from '@/components/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toGalleryCard } from '@/features/gallery-home/api'

export type GalleryWork = {
  id?: number
  title: string
  model: string
  kind?: 'image' | 'video'
  cover: string
  video?: string
  url: string
}

export type GallerySource = 'manual' | 'latest' | 'popular'

type PickerItem = {
  id: number
  title: string
  model: string
  type: string
  cover: string
  media: string
}

type Props = {
  source: GallerySource
  limit: number
  items: GalleryWork[]
  /** 手选列表是否已被后台覆盖 */
  itemsOverridden: boolean
  /** 来源是否已被后台覆盖 */
  sourceOverridden: boolean
  onSourceChange: (value: GallerySource) => void
  onLimitChange: (value: number) => void
  onChange: (items: GalleryWork[]) => void
  onResetItems: () => void
  onResetSource: () => void
}

const EMPTY_WORK: GalleryWork = {
  title: '',
  model: '',
  kind: 'image',
  cover: '',
  video: '',
  url: '/prompt-gallery',
}

export function GalleryItemsCard({
  source,
  limit,
  items,
  itemsOverridden,
  sourceOverridden,
  onSourceChange,
  onLimitChange,
  onChange,
  onResetItems,
  onResetSource,
}: Props) {
  const { t } = useTranslation()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [works, setWorks] = useState<PickerItem[]>([])
  const [loading, setLoading] = useState(false)

  // 打开选择器时才请求，避免每次进设置页都拉画廊
  useEffect(() => {
    if (!pickerOpen) return
    let alive = true
    setLoading(true)
    fetch('/api/prompt-gallery/v1/prompts?sort=latest&limit=24', {
      headers: { Accept: 'application/json' },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (!alive) return
        const list = (body?.data?.items ?? []) as PickerItem[]
        setWorks(Array.isArray(list) ? list : [])
      })
      .catch(() => alive && setWorks([]))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [pickerOpen])

  const patch = (index: number, next: Partial<GalleryWork>) => {
    onChange(items.map((it, i) => (i === index ? { ...it, ...next } : it)))
  }

  const move = (index: number, delta: number) => {
    const target = index + delta
    if (target < 0 || target >= items.length) return
    const next = [...items]
    const [row] = next.splice(index, 1)
    next.splice(target, 0, row)
    onChange(next)
  }

  const addFromGallery = (work: PickerItem) => {
    const card = toGalleryCard(work)
    onChange([
      ...items,
      {
        id: card.id,
        title: card.title,
        model: card.model,
        kind: card.kind,
        cover: card.cover ?? '',
        video: card.video ?? '',
        url: card.url,
      },
    ])
  }

  const sources: { key: GallerySource; title: string; desc: string }[] = [
    {
      key: 'manual',
      title: t('Manual selection'),
      desc: t('Use the list below, exactly as you arrange it.'),
    },
    {
      key: 'latest',
      title: t('Gallery latest'),
      desc: t('Always show the newest published works.'),
    },
    {
      key: 'popular',
      title: t('Gallery most popular'),
      desc: t('Always show the most viewed works.'),
    },
  ]

  return (
    <>
      <Card>
        <CardHeader className='pb-3'>
          <div className='flex flex-wrap items-center justify-between gap-2'>
            <CardTitle className='text-base'>{t('Gallery works source')}</CardTitle>
            {sourceOverridden && (
              <Button variant='outline' size='sm' onClick={onResetSource}>
                <RotateCcw className='size-3.5' /> {t('Restore default source')}
              </Button>
            )}
          </div>
          <p className='text-xs text-muted-foreground'>
            {t('Manual picks win when you set them. Otherwise the homepage pulls the latest or most popular works from the prompt gallery.')}
          </p>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='grid gap-2 sm:grid-cols-3'>
            {sources.map((s) => {
              const active = source === s.key
              return (
                <button
                  key={s.key}
                  type='button'
                  onClick={() => onSourceChange(s.key)}
                  className={[
                    'rounded-lg border p-3 text-left transition',
                    active
                      ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                      : 'border-border hover:bg-muted',
                  ].join(' ')}
                >
                  <div className='flex items-center justify-between gap-2'>
                    <span className='text-sm font-medium'>{s.title}</span>
                    {active && <Badge variant='outline'>{t('Active')}</Badge>}
                  </div>
                  <p className='mt-1 text-[11px] leading-relaxed text-muted-foreground'>
                    {s.desc}
                  </p>
                </button>
              )
            })}
          </div>

          <div className='flex flex-wrap items-end gap-3'>
            <div className='w-32 space-y-1.5'>
              <Label className='block text-xs'>{t('Number of works')}</Label>
              <Input
                type='number'
                min={1}
                max={24}
                value={String(limit)}
                onChange={(e) => {
                  const n = Number(e.target.value)
                  onLimitChange(
                    Number.isFinite(n) ? Math.min(Math.max(Math.round(n), 1), 24) : 10,
                  )
                }}
              />
            </div>
            <p className='flex-1 text-[11px] leading-relaxed text-muted-foreground'>
              {source === 'manual'
                ? t('Manual mode uses the list below, so the number here only applies to the automatic sources.')
                : t('Ten works fill the grid exactly: two large cards plus eight small ones.')}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className='pb-3'>
          <div className='flex flex-wrap items-center justify-between gap-2'>
            <div>
              <CardTitle className='text-base'>{t('Gallery works')}</CardTitle>
              <p className='mt-1 text-xs text-muted-foreground'>
                {t('Pick works from the prompt gallery; the cover and hover video are filled in automatically.')}
              </p>
            </div>
            <div className='flex flex-wrap gap-2'>
              <Button variant='outline' size='sm' onClick={() => setPickerOpen(true)}>
                <Images className='size-4' /> {t('Pick from gallery')}
              </Button>
              <Button
                variant='outline'
                size='sm'
                onClick={() => onChange([...items, { ...EMPTY_WORK }])}
              >
                <Plus className='size-4' /> {t('Add empty work')}
              </Button>
              {itemsOverridden && (
                <Button variant='ghost' size='sm' onClick={onResetItems}>
                  <RotateCcw className='size-3.5' /> {t('Restore default works')}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className='space-y-3'>
          {source !== 'manual' && (
            <div className='rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs'>
              {t('The source above is automatic, so this list is not used on the homepage. Switch to manual to use it.')}
            </div>
          )}

          {items.length === 0 && (
            <p className='rounded-md border border-dashed px-4 py-8 text-center text-sm text-muted-foreground'>
              {t('No works yet. Pick a few from the gallery.')}
            </p>
          )}

          {items.map((it, i) => (
            <div
              key={`${it.id ?? 'row'}-${i}`}
              className='flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-start'
            >
              <div className='flex items-center gap-2 sm:w-24 sm:flex-col'>
                <div className='relative h-16 w-14 shrink-0 overflow-hidden rounded-md border bg-muted'>
                  {it.cover ? (
                    <img src={it.cover} alt='' className='h-full w-full object-cover' />
                  ) : (
                    <span className='flex h-full w-full items-center justify-center text-[10px] text-muted-foreground'>
                      {t('No image')}
                    </span>
                  )}
                  {it.kind === 'video' && (
                    <span className='absolute left-1 top-1 rounded bg-black/60 px-1 py-0.5 text-[9px] text-white'>
                      <Video className='size-2.5' />
                    </span>
                  )}
                </div>
                <Badge variant='outline' className='tabular-nums'>
                  {String(i + 1).padStart(2, '0')}
                </Badge>
              </div>

              <div className='min-w-0 flex-1 space-y-2'>
                <Input
                  value={it.title}
                  placeholder={t('Work title')}
                  onChange={(e) => patch(i, { title: e.target.value })}
                />
                <div className='grid gap-2 sm:grid-cols-2'>
                  <Input
                    value={it.cover}
                    placeholder={t('Cover image (e.g. /images/home/a.webp)')}
                    onChange={(e) => patch(i, { cover: e.target.value })}
                  />
                  <Input
                    value={it.video ?? ''}
                    placeholder={t('Hover video, optional (e.g. /videos/a.mp4)')}
                    onChange={(e) => patch(i, { video: e.target.value })}
                  />
                </div>
                <div className='flex flex-wrap items-center gap-2'>
                  <Button
                    variant={it.kind === 'image' ? 'secondary' : 'outline'}
                    size='sm'
                    className='h-7 px-2 text-xs'
                    onClick={() => patch(i, { kind: 'image' })}
                  >
                    {t('Image')}
                  </Button>
                  <Button
                    variant={it.kind === 'video' ? 'secondary' : 'outline'}
                    size='sm'
                    className='h-7 px-2 text-xs'
                    onClick={() => patch(i, { kind: 'video' })}
                  >
                    {t('Video')}
                  </Button>
                  <Input
                    className='h-7 max-w-52 text-xs'
                    value={it.model}
                    placeholder={t('Model name')}
                    onChange={(e) => patch(i, { model: e.target.value })}
                  />
                </div>
              </div>

              <div className='flex gap-1 sm:flex-col'>
                <Button
                  variant='ghost'
                  size='icon'
                  className='size-8'
                  aria-label={t('Move up')}
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                >
                  <ArrowUp className='size-4' />
                </Button>
                <Button
                  variant='ghost'
                  size='icon'
                  className='size-8'
                  aria-label={t('Move down')}
                  disabled={i === items.length - 1}
                  onClick={() => move(i, 1)}
                >
                  <ArrowDown className='size-4' />
                </Button>
                <Button
                  variant='ghost'
                  size='icon'
                  className='size-8'
                  aria-label={t('Delete')}
                  onClick={() => onChange(items.filter((_, j) => j !== i))}
                >
                  <Trash2 className='size-4' />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        title={t('Pick from gallery')}
        description={t('Published works only. Videos come with their cover and hover playback.')}
        contentHeight='62vh'
      >
        {loading ? (
          <div className='flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground'>
            <Loader2 className='size-4 animate-spin' /> {t('Loading')}
          </div>
        ) : works.length === 0 ? (
          <p className='rounded-md border border-dashed px-4 py-12 text-center text-sm text-muted-foreground'>
            {t('No published works in the gallery yet.')}
          </p>
        ) : (
          <div className='grid grid-cols-2 gap-3 sm:grid-cols-3'>
            {works.map((w) => {
              const card = toGalleryCard(w)
              return (
                <button
                  key={w.id}
                  type='button'
                  onClick={() => addFromGallery(w)}
                  className='group overflow-hidden rounded-lg border text-left transition hover:border-primary hover:shadow-md'
                >
                  <span className='relative block aspect-[4/3] overflow-hidden bg-muted'>
                    {card.cover ? (
                      <img
                        src={card.cover}
                        alt=''
                        className='h-full w-full object-cover transition group-hover:scale-[1.03]'
                      />
                    ) : (
                      <span className='flex h-full w-full items-center justify-center text-xs text-muted-foreground'>
                        {t('No image')}
                      </span>
                    )}
                    <span className='absolute left-1.5 top-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white'>
                      {card.kind === 'video' ? t('Video') : t('Image')}
                    </span>
                  </span>
                  <span className='block px-2 py-1.5'>
                    <span className='block truncate text-xs font-medium'>{w.title}</span>
                    <span className='block truncate text-[11px] text-muted-foreground'>
                      {w.model}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </Dialog>
    </>
  )
}
