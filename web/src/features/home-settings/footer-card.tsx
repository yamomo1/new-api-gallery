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
 * 首页页脚编辑卡（后台「二开设置 → 首页设置 → Footer」）
 * ------------------------------------------------------------------
 * 编辑页脚的多栏导航（栏目标题 + 链接对）与法律声明行，写入
 * HomeConfig.shared.footer.columns / footer.legal。
 * 布局对标 aliyun.com 2025 页脚；版权/关于文案在「Footer」文案分组里按语种编辑。
 */
import { ArrowDown, ArrowUp, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export type FooterLink = { label: string; href: string }
export type FooterColumn = { title?: string; items?: FooterLink[] }

type Props = {
  columns: FooterColumn[]
  legal: FooterLink[]
  /** 数组是否已被后台覆盖（用于显示「恢复默认」） */
  columnsOverridden: boolean
  legalOverridden: boolean
  onChangeColumns: (columns: FooterColumn[]) => void
  onChangeLegal: (links: FooterLink[]) => void
  onResetColumns: () => void
  onResetLegal: () => void
}

const EMPTY_LINK: FooterLink = { label: '', href: '/' }
const EMPTY_COLUMN: FooterColumn = { title: '', items: [{ ...EMPTY_LINK }] }

function move<T>(arr: T[], i: number, dir: -1 | 1): T[] {
  const j = i + dir
  if (j < 0 || j >= arr.length) return arr
  const next = [...arr]
  const tmp = next[i]
  next[i] = next[j]
  next[j] = tmp
  return next
}

export function FooterCard({
  columns,
  legal,
  columnsOverridden,
  legalOverridden,
  onChangeColumns,
  onChangeLegal,
  onResetColumns,
  onResetLegal,
}: Props) {
  const { t } = useTranslation()

  const updateColumn = (ci: number, patch: Partial<FooterColumn>) => {
    onChangeColumns(
      columns.map((c, j) => (j === ci ? { ...c, ...patch } : { ...c })),
    )
  }

  const updateLink = (
    ci: number | null,
    li: number,
    patch: Partial<FooterLink>,
  ) => {
    if (ci === null) {
      onChangeLegal(legal.map((l, j) => (j === li ? { ...l, ...patch } : l)))
      return
    }
    onChangeColumns(
      columns.map((c, j) => {
        if (j !== ci) return c
        const items = (c.items ?? []).map((l, k) =>
          k === li ? { ...l, ...patch } : l,
        )
        return { ...c, items }
      }),
    )
  }

  const addLink = (ci: number | null) => {
    if (ci === null) {
      onChangeLegal([...legal, { ...EMPTY_LINK }])
      return
    }
    onChangeColumns(
      columns.map((c, j) =>
        j === ci ? { ...c, items: [...(c.items ?? []), { ...EMPTY_LINK }] } : c,
      ),
    )
  }

  const removeLink = (ci: number | null, li: number) => {
    if (ci === null) {
      onChangeLegal(legal.filter((_, j) => j !== li))
      return
    }
    onChangeColumns(
      columns.map((c, j) =>
        j === ci ? { ...c, items: (c.items ?? []).filter((_, k) => k !== li) } : c,
      ),
    )
  }

  const linkRow = (link: FooterLink, ci: number | null, li: number) => (
    <div key={`${ci}-${li}`} className='flex items-end gap-2'>
      <div className='min-w-0 flex-1 space-y-1'>
        <Label className='text-[11px]'>{t('Link text')}</Label>
        <Input
          value={link.label}
          placeholder={t('Prompt gallery')}
          onChange={(e) => updateLink(ci, li, { label: e.target.value })}
        />
      </div>
      <div className='min-w-0 flex-[1.3] space-y-1'>
        <Label className='text-[11px]'>{t('Link URL')}</Label>
        <Input
          value={link.href}
          placeholder='/prompt-gallery'
          onChange={(e) => updateLink(ci, li, { href: e.target.value })}
        />
      </div>
      <div className='flex shrink-0 gap-1 pb-0.5'>
        <Button
          variant='ghost'
          size='icon'
          className='size-8'
          aria-label={t('Move up')}
          onClick={() =>
            ci === null
              ? onChangeLegal(move(legal, li, -1))
              : onChangeColumns(
                  columns.map((c, j) =>
                    j === ci ? { ...c, items: move(c.items ?? [], li, -1) } : c,
                  ),
                )
          }
        >
          <ArrowUp className='size-3.5' />
        </Button>
        <Button
          variant='ghost'
          size='icon'
          className='size-8'
          aria-label={t('Move down')}
          onClick={() =>
            ci === null
              ? onChangeLegal(move(legal, li, 1))
              : onChangeColumns(
                  columns.map((c, j) =>
                    j === ci ? { ...c, items: move(c.items ?? [], li, 1) } : c,
                  ),
                )
          }
        >
          <ArrowDown className='size-3.5' />
        </Button>
        <Button
          variant='ghost'
          size='icon'
          className='size-8 text-destructive hover:text-destructive'
          aria-label={t('Remove')}
          onClick={() => removeLink(ci, li)}
        >
          <Trash2 className='size-3.5' />
        </Button>
      </div>
    </div>
  )

  return (
    <Card>
      <CardHeader className='pb-3'>
        <div className='flex flex-wrap items-center justify-between gap-2'>
          <div>
            <CardTitle className='text-base'>
              {t('Footer columns & links')}
            </CardTitle>
            <p className='mt-1 text-xs text-muted-foreground'>
              {t(
                'Each column renders as a link group in the footer. External URLs open in a new tab.',
              )}
            </p>
          </div>
          <div className='flex items-center gap-2'>
            {columnsOverridden && (
              <Button variant='outline' size='sm' onClick={onResetColumns}>
                <RotateCcw className='size-4' /> {t('Restore default columns')}
              </Button>
            )}
            <Button
              variant='outline'
              size='sm'
              onClick={() => onChangeColumns([...columns, { ...EMPTY_COLUMN }])}
            >
              <Plus className='size-4' /> {t('Add a column')}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className='space-y-3'>
        {columns.length === 0 && (
          <p className='rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground'>
            {t('No columns yet. Add one to fill the footer.')}
          </p>
        )}

        {columns.map((col, ci) => (
          <div key={ci} className='rounded-lg border bg-card/40 p-3'>
            <div className='mb-2 flex items-end gap-2'>
              <div className='min-w-0 flex-1 space-y-1'>
                <Label className='text-[11px]'>{t('Column title')}</Label>
                <Input
                  value={col.title ?? ''}
                  placeholder={t('Explore')}
                  onChange={(e) => updateColumn(ci, { title: e.target.value })}
                />
              </div>
              <div className='flex shrink-0 gap-1 pb-0.5'>
                <Button
                  variant='ghost'
                  size='icon'
                  className='size-8'
                  aria-label={t('Move up')}
                  onClick={() => onChangeColumns(move(columns, ci, -1))}
                >
                  <ArrowUp className='size-3.5' />
                </Button>
                <Button
                  variant='ghost'
                  size='icon'
                  className='size-8'
                  aria-label={t('Move down')}
                  onClick={() => onChangeColumns(move(columns, ci, 1))}
                >
                  <ArrowDown className='size-3.5' />
                </Button>
                <Button
                  variant='ghost'
                  size='icon'
                  className='size-8 text-destructive hover:text-destructive'
                  aria-label={t('Remove')}
                  onClick={() =>
                    onChangeColumns(columns.filter((_, j) => j !== ci))
                  }
                >
                  <Trash2 className='size-3.5' />
                </Button>
              </div>
            </div>

            <div className='space-y-2'>
              {(col.items ?? []).map((link, li) => linkRow(link, ci, li))}
              <Button
                variant='ghost'
                size='sm'
                className='h-7 gap-1 text-xs'
                onClick={() => addLink(ci)}
              >
                <Plus className='size-3.5' /> {t('Add a link')}
              </Button>
            </div>
          </div>
        ))}

        {/* 法律声明行 */}
        <div className='rounded-lg border bg-card/40 p-3'>
          <div className='mb-2 flex flex-wrap items-center justify-between gap-2'>
            <Label className='text-[11px]'>{t('Legal row (bottom)')}</Label>
            <div className='flex items-center gap-2'>
              {legalOverridden && (
                <Button variant='outline' size='sm' onClick={onResetLegal}>
                  <RotateCcw className='size-3.5' /> {t('Restore default')}
                </Button>
              )}
              <Button
                variant='ghost'
                size='sm'
                className='h-7 gap-1 text-xs'
                onClick={() => addLink(null)}
              >
                <Plus className='size-3.5' /> {t('Add a link')}
              </Button>
            </div>
          </div>
          <div className='space-y-2'>
            {legal.map((link, li) => linkRow(link, null, li))}
            {legal.length === 0 && (
              <p className='text-xs text-muted-foreground'>
                {t('No legal links yet.')}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
