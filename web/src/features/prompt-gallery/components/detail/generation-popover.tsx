import { Box, Check, ChevronRight, Copy, Wand2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { copyText } from '../../utils'
import type { PromptGalleryItem } from '../../types'

type ModelRow = { key: string; name: string; hint?: string }

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
 * 「生成信息」浮层（覆盖在图片上，对齐 liblib 的生成信息卡）
 * ---------------------------------------------------------------
 * 提示词区固定最大高度、超出内部滚动，不让长提示词把卡片撑到出屏；
 * 「做同款」直接滚到页面下方的创作入口（那里才有真正的四种下载/一键生图能力）。
 */
export function GenerationPopover({
  item,
  onUse,
}: {
  item: PromptGalleryItem
  onUse: () => void
}) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  const enPrompt = item.prompt_en?.trim() ?? ''
  const bilingual = Boolean(enPrompt)
  const [lang, setLang] = useState<'en' | 'zh'>('en')
  const text = bilingual && lang === 'en' ? enPrompt : item.prompt

  useEffect(() => {
    setCopied(false)
    setLang('en')
  }, [item.id])

  const modelRows = useMemo<ModelRow[]>(() => {
    const rows = parseModelRows(item.model_sources)
    const main: ModelRow[] = item.model
      ? [{ key: `main:${item.model}`, name: item.model, hint: '' }]
      : []
    // 主模型已在第一行，来源里同名的去重
    const seen = new Set(main.map((row) => row.name.toLowerCase()))
    return [...main, ...rows.filter((row) => !seen.has(row.name.toLowerCase()))]
  }, [item.model, item.model_sources])

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

  return (
    <div
      role='dialog'
      aria-label={t('Generation info', { defaultValue: '生成信息' })}
      /* 底部留 48px 给「生成信息」按钮；外圈给可见描边，把卡片「框住」 */
      className='absolute inset-x-2.5 bottom-12 z-30 flex max-h-[calc(100%-3.5rem)] flex-col overflow-y-auto rounded-2xl border border-[#E2E5EC] bg-white p-4 text-left shadow-[0_16px_40px_-16px_rgba(15,20,25,0.35)] [scrollbar-width:thin] md:inset-x-3 dark:border-border dark:bg-card'
      onClick={(event) => event.stopPropagation()}
    >
      <div className='flex shrink-0 items-center justify-between gap-2'>
        <h3 className='text-[13.5px] font-semibold text-foreground'>
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
                      ? 'rounded-full bg-background px-1.5 py-0.5 text-[11px] font-medium text-foreground shadow-sm'
                      : 'rounded-full px-1.5 py-0.5 text-[11px] text-muted-foreground'
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
            className='inline-flex items-center gap-1 text-[12px] text-muted-foreground transition-colors hover:text-foreground'
          >
            {copied ? <Check className='size-3.5' /> : <Copy className='size-3.5' />}
            {t('Copy', { defaultValue: '复制' })}
          </button>
        </div>
      </div>

      <p className='mt-2 max-h-[168px] shrink-0 overflow-y-auto pr-1 text-[12.5px] leading-[1.75] whitespace-pre-wrap text-foreground/85 [scrollbar-width:thin]'>
        {text}
      </p>

      {modelRows.length > 0 && (
        <div className='mt-3 border-t border-border/60 pt-3'>
          <h4 className='text-[12.5px] font-medium text-muted-foreground'>
            {t('Model info', { defaultValue: '模型信息' })}
          </h4>
          <div className='mt-2 space-y-1.5'>
            {modelRows.slice(0, 3).map((row) => (
              <div
                key={row.key}
                className='flex items-center gap-2 rounded-lg border border-border/60 bg-background/60 px-2 py-1.5'
              >
                <span className='flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/12 text-primary'>
                  <Box className='size-3.5' />
                </span>
                <span className='min-w-0 flex-1 truncate text-[12.5px] text-foreground/85'>
                  {row.name}
                </span>
                {row.hint && (
                  <span className='shrink-0 text-[11px] text-muted-foreground'>
                    {row.hint}
                  </span>
                )}
                <ChevronRight className='size-3.5 shrink-0 text-muted-foreground/60' />
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        type='button'
        onClick={onUse}
        className='mt-3.5 inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[#FED578] text-[13px] font-medium text-[#8A4200] transition-opacity hover:opacity-90'
      >
        <Wand2 className='size-4' />
        {t('Create the same', { defaultValue: '做同款' })}
      </button>
    </div>
  )
}
