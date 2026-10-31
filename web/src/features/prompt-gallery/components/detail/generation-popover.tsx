import { Box, Check, ChevronRight, Copy, Wand2 } from 'lucide-react'
import { useEffect, useLayoutEffect, useMemo, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { copyText } from '../../utils'
import type { PromptGalleryItem } from '../../types'

type ModelRow = { key: string; name: string; hint?: string }

/** 浮层宽度：比图片卡内那版更大，最大不超过视口 */
const POPOVER_WIDTH = 460

/** 解析 model_sources（JSON 数组字符串），失败返回空数组 */
function parseModelRows(raw?: string): ModelRow[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((v): v is Record<string, unknown> => Boolean(v) && typeof v === 'object')
      .map((v, i) => ({
        key: `${String(v.url ?? v.name ?? i)}`,
        name: String(v.name ?? '').trim() || String(v.url ?? '').trim(),
        hint: String(v.dir ?? v.type ?? '').trim(),
      }))
      .filter((row) => Boolean(row.name))
  } catch {
    return []
  }
}

/**
 * 「生成信息」浮层（悬浮/点击「生成信息」按钮才出现）
 * ---------------------------------------------------------------
 * 用 portal 挂到 body + fixed 定位：参考站这个卡片是浮在图片之上的独立面板，
 * 不能被图片卡片的 `overflow-hidden` 裁掉，所以不能用 absolute 挂在 figure 里。
 *
 * 定位规则：贴着按钮显示（按钮在上方就往上弹、下方不够就往下弹），
 * 左右钳制在视口内；高度按可用空间给 max-height，内容超出内部滚动。
 */
export function GenerationPopover({
  item,
  anchorRect,
  onUse,
  onMouseEnter,
  onMouseLeave,
}: {
  item: PromptGalleryItem
  anchorRect: DOMRect
  onUse: () => void
  onMouseEnter: () => void
  onMouseLeave: () => void
}) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  const enPrompt = item.prompt_en?.trim() ?? ''
  const bilingual = Boolean(enPrompt)
  const [lang, setLang] = useState<'en' | 'zh'>('en')
  const text = bilingual && lang === 'en' ? enPrompt : item.prompt
  const [style, setStyle] = useState<CSSProperties>({ opacity: 0 })

  const modelRows = useMemo<ModelRow[]>(() => {
    const rows = parseModelRows(item.model_sources)
    const main: ModelRow[] = item.model
      ? [{ key: `main:${item.model}`, name: item.model, hint: '' }]
      : []
    // 主模型已在第一行，来源里同名的去重
    const seen = new Set(main.map((row) => row.name.toLowerCase()))
    return [...main, ...rows.filter((row) => !seen.has(row.name.toLowerCase()))]
  }, [item.model, item.model_sources])

  useEffect(() => {
    setCopied(false)
    setLang('en')
  }, [item.id])

  // 位置按锚点按钮的实时位置算：优先向上展开，上方不够再向下
  useLayoutEffect(() => {
    const gap = 10
    const width = Math.min(POPOVER_WIDTH, window.innerWidth - 32)
    const left = Math.max(
      16,
      Math.min(anchorRect.left, window.innerWidth - width - 16)
    )
    const openUp = anchorRect.top > 300
    if (openUp) {
      setStyle({
        left,
        width,
        bottom: window.innerHeight - anchorRect.top + gap,
        maxHeight: anchorRect.top - gap - 12,
      })
      return
    }
    setStyle({
      left,
      width,
      top: anchorRect.bottom + gap,
      maxHeight: window.innerHeight - anchorRect.bottom - gap - 12,
    })
  }, [anchorRect])

  const handleCopy = async () => {
    const ok = await copyText(text)
    if (!ok) {
      toast.error(t('Copy failed'))
      return
    }
    setCopied(true)
    toast.success(t('Prompt copied'))
    setTimeout(() => setCopied(false), 1500)
  }

  const content = (
    <div
      role='dialog'
      aria-label={t('Generation info', { defaultValue: '生成信息' })}
      style={style}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={(event) => event.stopPropagation()}
      className='fixed z-[120] flex flex-col overflow-y-auto rounded-2xl border border-[#E2E5EC] bg-white p-5 text-left shadow-[0_24px_60px_-20px_rgba(15,20,25,0.45)] [scrollbar-width:thin] dark:border-border dark:bg-card'
    >
      <div className='flex shrink-0 items-center justify-between gap-2'>
        <h3 className='text-[15px] font-semibold text-foreground'>
          {t('Prompt text', { defaultValue: '提示词' })}
        </h3>
        <div className='flex items-center gap-2'>
          {bilingual && (
            <div className='inline-flex rounded-full bg-muted p-0.5'>
              {(
                [
                  { key: 'en', label: 'EN' },
                  { key: 'zh', label: '中' },
                ] as const
              ).map(({ key, label }) => (
                <button
                  key={key}
                  type='button'
                  aria-pressed={lang === key}
                  onClick={() => setLang(key)}
                  className={
                    lang === key
                      ? 'rounded-full bg-background px-2 py-0.5 text-[11.5px] font-medium text-foreground shadow-sm'
                      : 'rounded-full px-2 py-0.5 text-[11.5px] text-muted-foreground'
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          <button
            type='button'
            onClick={handleCopy}
            className='inline-flex items-center gap-1 text-[12.5px] text-muted-foreground transition-colors hover:text-foreground'
          >
            {copied ? <Check className='size-4' /> : <Copy className='size-4' />}
            {t('Copy', { defaultValue: '复制' })}
          </button>
        </div>
      </div>

      <p className='mt-2.5 max-h-[220px] shrink-0 overflow-y-auto pr-1 text-[13.5px] leading-[1.8] whitespace-pre-wrap text-foreground/85 [scrollbar-width:thin]'>
        {text}
      </p>

      {modelRows.length > 0 && (
        <div className='mt-3.5 border-t border-border/60 pt-3.5'>
          <h4 className='text-[13px] font-medium text-muted-foreground'>
            {t('Model info', { defaultValue: '模型信息' })}
          </h4>
          <div className='mt-2 space-y-1.5'>
            {modelRows.slice(0, 3).map((row) => (
              <div
                key={row.key}
                className='flex h-9 items-center gap-2 rounded-lg border border-border/60 bg-background/60 px-2.5'
              >
                <span className='flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/12 text-primary'>
                  <Box className='size-3.5' />
                </span>
                <span className='min-w-0 flex-1 truncate text-[13px] text-foreground/85'>
                  {row.name}
                </span>
                {row.hint && (
                  <span className='shrink-0 text-[11px] text-muted-foreground'>
                    {row.hint}
                  </span>
                )}
                <ChevronRight className='size-4 shrink-0 text-muted-foreground/60' />
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        type='button'
        onClick={onUse}
        className='mt-4 inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[#FED578] text-[14px] font-medium text-[#8A4200] transition-opacity hover:opacity-90'
      >
        <Wand2 className='size-4' />
        {t('Create the same', { defaultValue: '做同款' })}
      </button>
    </div>
  )

  if (typeof document === 'undefined') return content
  return createPortal(content, document.body)
}
