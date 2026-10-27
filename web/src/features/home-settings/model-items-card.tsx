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
 * 精选模型列表编辑器（首页设置 → 精选模型）
 * ------------------------------------------------------------------
 * 首页 04 区块的「左预览 + 右列表」由这份数组驱动：
 * 每一项 = 一张预览图 + 名称 + 分类徽章 + 能力标签 + 点击链接。
 * 悬停列表任意一行，左侧预览就会换成该项的图。
 *
 * 数据存放在 shared.models.items（跨语种共用，改一次全站生效）；
 * 数组是整体替换语义，所以每次编辑都写回完整数组。
 */
import { ArrowDown, ArrowUp, ImageIcon, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export type ModelItem = {
  rank?: number
  name: string
  category?: string
  capability?: string
  thumb: string
  url: string
}

type Props = {
  items: ModelItem[]
  /** 是否已被后台覆盖（用于显示「恢复默认」） */
  overridden: boolean
  onChange: (items: ModelItem[]) => void
  onReset: () => void
}

const EMPTY_ITEM: ModelItem = {
  name: '',
  category: '',
  capability: '',
  thumb: '',
  url: '/pricing',
}

export function ModelItemsCard({ items, overridden, onChange, onReset }: Props) {
  const { t } = useTranslation()

  const update = (i: number, patch: Partial<ModelItem>) => {
    const next = items.map((it, j) => (j === i ? { ...it, ...patch } : { ...it }))
    onChange(next)
  }

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= items.length) return
    const next = items.map((it) => ({ ...it }))
    const tmp = next[i]
    next[i] = next[j]
    next[j] = tmp
    onChange(next)
  }

  const remove = (i: number) => onChange(items.filter((_, j) => j !== i))

  return (
    <Card>
      <CardHeader className='pb-3'>
        <div className='flex flex-wrap items-center justify-between gap-2'>
          <div>
            <CardTitle className='text-base'>{t('Featured models')}</CardTitle>
            <p className='mt-1 text-xs text-muted-foreground'>
              {t(
                'Each entry drives one row on the homepage. Hovering a row swaps the preview image on the left, so pick a picture that matches the model.',
              )}
            </p>
          </div>
          <div className='flex items-center gap-2'>
            {overridden && (
              <Button variant='outline' size='sm' onClick={onReset}>
                <RotateCcw className='size-4' /> {t('Restore default list')}
              </Button>
            )}
            <Button
              variant='outline'
              size='sm'
              onClick={() => onChange([...items, { ...EMPTY_ITEM }])}
            >
              <Plus className='size-4' /> {t('Add a model')}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className='space-y-3'>
        {items.length === 0 && (
          <p className='rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground'>
            {t('No models yet. Add one to fill this section.')}
          </p>
        )}

        {items.map((item, i) => (
          <div
            key={`${item.name}-${i}`}
            className='rounded-lg border bg-card/40 p-3'
          >
            <div className='flex gap-3'>
              {/* 缩略图预览：直接读图片路径，改路径即时预览 */}
              <div className='relative h-24 w-20 shrink-0 overflow-hidden rounded-md border bg-muted'>
                {item.thumb ? (
                  <img
                    src={item.thumb}
                    alt=''
                    className='size-full object-cover'
                    loading='lazy'
                  />
                ) : (
                  <span className='flex size-full items-center justify-center text-muted-foreground'>
                    <ImageIcon className='size-5' />
                  </span>
                )}
                <Badge
                  variant='secondary'
                  className='absolute left-1 top-1 h-5 px-1.5 text-[10px] tabular-nums'
                >
                  {String(i + 1).padStart(2, '0')}
                </Badge>
              </div>

              <div className='min-w-0 flex-1 space-y-2'>
                <div className='grid gap-2 sm:grid-cols-3'>
                  <div className='space-y-1'>
                    <Label className='text-[11px]'>{t('Model name')}</Label>
                    <Input
                      value={item.name}
                      placeholder='Seedance 2.5'
                      onChange={(e) => update(i, { name: e.target.value })}
                    />
                  </div>
                  <div className='space-y-1'>
                    <Label className='text-[11px]'>{t('Category badge')}</Label>
                    <Input
                      value={item.category ?? ''}
                      placeholder={t('Video generation')}
                      onChange={(e) => update(i, { category: e.target.value })}
                    />
                  </div>
                  <div className='space-y-1'>
                    <Label className='text-[11px]'>{t('Capability tag')}</Label>
                    <Input
                      value={item.capability ?? ''}
                      placeholder={t('Text to video')}
                      onChange={(e) => update(i, { capability: e.target.value })}
                    />
                  </div>
                </div>
                <div className='grid gap-2 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]'>
                  <div className='space-y-1'>
                    <Label className='text-[11px]'>{t('Preview image path')}</Label>
                    <Input
                      value={item.thumb}
                      placeholder='/images/home/model-cinema-v4.webp'
                      onChange={(e) => update(i, { thumb: e.target.value })}
                    />
                  </div>
                  <div className='space-y-1'>
                    <Label className='text-[11px]'>{t('Link')}</Label>
                    <Input
                      value={item.url}
                      placeholder='/pricing'
                      onChange={(e) => update(i, { url: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className='flex shrink-0 flex-col gap-1'>
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
                  className='size-8 text-destructive'
                  aria-label={t('Delete')}
                  onClick={() => remove(i)}
                >
                  <Trash2 className='size-4' />
                </Button>
              </div>
            </div>
          </div>
        ))}

        <p className='text-xs text-muted-foreground'>
          {t(
            'Images live under web/public, so a path like /images/home/xxx.webp maps to web/public/images/home/xxx.webp.',
          )}
        </p>
      </CardContent>
    </Card>
  )
}

export default ModelItemsCard
