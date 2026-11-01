/*
 * 选择模型弹窗（对齐 liblib「选择模型」）
 * - 宽 856、圆角 16、标题 16px + 右上关闭
 * - 双列卡片：图标 44、名称 15/600 + NEW 角标、说明 12 muted、能力标签 11px
 * - 选中态：浅蓝底 + 蓝边
 * 数据来自后台模型目录，按页面类别（image / video）过滤。
 */
import { X } from 'lucide-react'
import { useMemo, useState } from 'react'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useModelsByCategory } from '@/hooks/use-model-catalog'
import type { CatalogModel, ModelCategory } from '@/lib/model-catalog'

const ICON_STYLE: Record<string, { bg: string; fg: string; glyph: string }> = {
  spark: { bg: '#EEF0FF', fg: '#5B5BD6', glyph: '✧' },
  wave: { bg: '#E9F3FF', fg: '#3D6DFF', glyph: '≋' },
  hex: { bg: '#FFF1E8', fg: '#E8773D', glyph: '✕' },
  orbit: { bg: '#F3EDFF', fg: '#8B5CF6', glyph: '◍' },
  leaf: { bg: '#E9F8EF', fg: '#2F9E63', glyph: '❧' },
}

export function ModelPickerDialog({
  open,
  onOpenChange,
  category,
  value,
  onSelect,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  category: ModelCategory
  value?: string
  onSelect: (model: CatalogModel) => void
}) {
  const models = useModelsByCategory(category)
  const [hover, setHover] = useState<string | null>(null)
  const activeId = useMemo(
    () => models.find((m) => m.name === value)?.id ?? null,
    [models, value]
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className='dark:bg-card w-[856px] max-w-[calc(100vw-32px)] gap-0 rounded-2xl border-0 bg-white p-0 shadow-[0_12px_48px_rgba(0,0,0,0.16)] sm:max-w-[856px]'
        showCloseButton={false}
      >
        <DialogHeader className='flex flex-row items-center justify-between px-6 pt-5 pb-3'>
          <DialogTitle className='text-foreground text-[16px] font-semibold'>
            选择模型
          </DialogTitle>
          <button
            type='button'
            onClick={() => onOpenChange(false)}
            className='text-muted-foreground hover:text-foreground -mr-1 flex size-8 items-center justify-center rounded-lg'
            aria-label='关闭'
          >
            <X className='size-4.5' />
          </button>
        </DialogHeader>

        <div className='max-h-[520px] overflow-y-auto px-6 pb-6'>
          <div className='grid grid-cols-1 gap-3 md:grid-cols-2'>
            {models.map((model) => {
              const selected = model.id === activeId
              const isHover = hover === model.id
              const style = ICON_STYLE[model.icon ?? 'spark'] ?? ICON_STYLE.spark
              return (
                <button
                  key={model.id}
                  type='button'
                  onMouseEnter={() => setHover(model.id)}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => {
                    onSelect(model)
                    onOpenChange(false)
                  }}
                  className={`flex items-start gap-3 rounded-xl border p-3 text-left transition-colors ${
                    selected
                      ? 'border-primary bg-primary/5 dark:bg-primary/10'
                      : isHover
                        ? 'border-border bg-muted/40 border'
                        : 'border-border/70 bg-white dark:bg-card'
                  }`}
                >
                  <span
                    className='flex size-11 shrink-0 items-center justify-center rounded-[10px] text-lg'
                    style={{ backgroundColor: style.bg, color: style.fg }}
                  >
                    {style.glyph}
                  </span>
                  <span className='min-w-0 flex-1'>
                    <span className='flex items-center gap-1.5'>
                      <span className='text-foreground truncate text-[15px] font-semibold'>
                        {model.name}
                      </span>
                      {model.badge && (
                        <span className='shrink-0 rounded-[4px] bg-warning/15 px-1 py-0.5 text-[10px] font-semibold text-warning'>
                          {model.badge}
                        </span>
                      )}
                    </span>
                    {model.description && (
                      <span className='text-muted-foreground mt-0.5 block truncate text-[12px]'>
                        {model.description}
                      </span>
                    )}
                    {model.tags?.length ? (
                      <span className='mt-1.5 flex flex-wrap gap-1'>
                        {model.tags.map((tag) => (
                          <span
                            key={tag}
                            className='bg-muted/70 text-muted-foreground rounded-[4px] px-1.5 py-0.5 text-[11px]'
                          >
                            {tag}
                          </span>
                        ))}
                      </span>
                    ) : null}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
