/*
 * 选择模型弹窗（对齐 liblib「选择模型」）
 * - 宽 856、圆角 16、标题 16px + 右上关闭
 * - 双列卡片：图标 44、名称 15/600 + NEW 角标、说明 12 muted、能力标签 11px
 * - 选中态：浅蓝底 + 蓝边
 *
 * 数据优先级：
 *   1. New API「模型资料」（/api/model-catalog）—— 图标 / 说明 / 标签 / NEW 均取自后台；
 *   2. 该分类在服务端为空时，回退到 Fork 自维护目录（GalleryModelCatalog），避免弹窗空白。
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
import { useServerModelsByCategory } from '@/hooks/use-server-model-catalog'
import type { CatalogModel, ModelCategory } from '@/lib/model-catalog'

const ICON_STYLE: Record<string, { bg: string; fg: string; glyph: string }> = {
  spark: { bg: '#EEF0FF', fg: '#5B5BD6', glyph: '✧' },
  wave: { bg: '#E9F3FF', fg: '#3D6DFF', glyph: '≋' },
  hex: { bg: '#FFF1E8', fg: '#E8773D', glyph: '✕' },
  orbit: { bg: '#F3EDFF', fg: '#8B5CF6', glyph: '◍' },
  leaf: { bg: '#E9F8EF', fg: '#2F9E63', glyph: '❧' },
}

function ModelAvatar({ model }: { model: CatalogModel }) {
  if (model.iconUrl) {
    return (
      <span className='bg-muted/50 flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-[10px]'>
        <img
          src={model.iconUrl}
          alt=''
          className='size-full object-contain'
          loading='lazy'
        />
      </span>
    )
  }

  const key = model.icon ?? 'spark'
  const style = ICON_STYLE[key]
  // 后台可能填 emoji 或单个汉字：直接当图标内容，不再套内置样式
  if (!style && key) {
    return (
      <span className='bg-muted/50 flex size-11 shrink-0 items-center justify-center rounded-[10px] text-lg'>
        {key}
      </span>
    )
  }
  const resolved = style ?? ICON_STYLE.spark
  return (
    <span
      className='flex size-11 shrink-0 items-center justify-center rounded-[10px] text-lg'
      style={{ backgroundColor: resolved.bg, color: resolved.fg }}
    >
      {resolved.glyph}
    </span>
  )
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
  const server = useServerModelsByCategory(category)
  const fallback = useModelsByCategory(category)
  const [hover, setHover] = useState<string | null>(null)

  // 服务端有该分类的模型就用服务端；否则回退自维护目录
  const models = server.models.length > 0 ? server.models : fallback
  const usingServer = server.models.length > 0
  const loading = server.isLoading && server.models.length === 0

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
          <div className='flex items-baseline gap-2'>
            <DialogTitle className='text-foreground text-[16px] font-semibold'>
              选择模型
            </DialogTitle>
            <span className='text-muted-foreground text-[11px]'>
              {category === 'video' ? '视频模型' : '图片模型'}
            </span>
          </div>
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
          {loading ? (
            <div className='grid grid-cols-1 gap-3 md:grid-cols-2'>
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className='bg-muted/40 h-[84px] animate-pulse rounded-xl'
                />
              ))}
            </div>
          ) : models.length === 0 ? (
            <div className='text-muted-foreground flex min-h-32 items-center justify-center text-[13px]'>
              还没有可用的{category === 'video' ? '视频' : '图片'}模型，请先在后台配置模型资料与渠道。
            </div>
          ) : (
            <>
              {!usingServer && (
                <div className='text-muted-foreground mb-3 rounded-lg bg-amber-500/10 px-3 py-2 text-[12px] text-amber-700 dark:text-amber-300'>
                  正在使用站点自定义模型目录。到后台「模型」给模型补上说明、图标与标签后，这里会自动切换。
                </div>
              )}
              <div className='grid grid-cols-1 gap-3 md:grid-cols-2'>
                {models.map((model) => {
                  const selected = model.id === activeId
                  const isHover = hover === model.id
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
                      <ModelAvatar model={model} />
                      <span className='min-w-0 flex-1'>
                        <span className='flex items-center gap-1.5'>
                          <span className='text-foreground truncate text-[15px] font-semibold'>
                            {model.name}
                          </span>
                          {model.badge && (
                            <span className='bg-warning/15 text-warning shrink-0 rounded-[4px] px-1 py-0.5 text-[10px] font-semibold'>
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
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
