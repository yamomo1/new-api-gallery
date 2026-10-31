import { Check, Copy } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { cn } from '@/lib/utils'

import type { PromptGalleryItem } from '../../types'
import { copyText } from '../../utils'
import { MetaChip } from './detail-parts'

/**
 * 生成信息卡：模型 + 提示词（双语可切换、可复制）。
 * ---------------------------------------------------------------
 * 版式对齐 liblib 的「生成信息」面板，并沿用右栏参数表的表格线：
 * 左标签列带右侧竖线，行间横线。
 *
 * 提示词长度不可控（有的用户会贴一整段分镜），所以文本区固定最大高度、
 * 超出纵向滚动——不能把左侧内容列撑到几千像素，那样右栏与推荐位全被推走。
 */
export function GenerationInfo({ item }: { item: PromptGalleryItem }) {
  const { t } = useTranslation()
  const enPrompt = item.prompt_en ?? ''
  const bilingual = Boolean(enPrompt.trim())
  const [lang, setLang] = useState<'en' | 'zh'>('en')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setCopied(false)
    setLang('en')
  }, [item.id])

  const text = bilingual && lang === 'en' ? enPrompt : item.prompt

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
    <section>
      <div className='mb-2.5 flex items-center justify-between gap-3'>
        <h2 className='text-[15px] font-semibold text-foreground'>
          {t('Generation info', { defaultValue: '生成信息' })}
        </h2>
        <button
          type='button'
          onClick={handleCopy}
          className='inline-flex shrink-0 items-center gap-1 rounded-md border border-border/60 px-2.5 py-1 text-[12px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary'
        >
          {copied ? (
            <Check className='size-3.5' />
          ) : (
            <Copy className='size-3.5' />
          )}
          {t('Copy prompt', { defaultValue: '复制提示词' })}
        </button>
      </div>

      <div className='overflow-hidden rounded-xl border border-border/60 bg-card'>
        {/* 模型行 */}
        <div className='flex border-b border-border/50'>
          <div className='w-[84px] shrink-0 border-r border-border/50 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-muted-foreground'>
            {t('Model', { defaultValue: '模型' })}
          </div>
          <div className='flex min-w-0 flex-1 flex-wrap items-center gap-1.5 px-3.5 py-2'>
            {item.model ? (
              <MetaChip tone='primary'>{item.model}</MetaChip>
            ) : (
              <span className='text-[12.5px] text-muted-foreground'>—</span>
            )}
          </div>
        </div>

        {/* 提示词行：多语 Tab + 固定高度滚动区 */}
        <div className='flex'>
          <div className='w-[84px] shrink-0 border-r border-border/50 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-muted-foreground'>
            {t('Prompt text', { defaultValue: '提示词' })}
          </div>
          <div className='min-w-0 flex-1 px-3.5 py-2.5'>
            {bilingual && (
              <div className='mb-2 inline-flex rounded-full bg-muted p-0.5'>
                {(
                  [
                    { key: 'en', label: t('English') },
                    { key: 'zh', label: t('Chinese') },
                  ] as const
                ).map(({ key, label }) => (
                  <button
                    key={key}
                    type='button'
                    aria-pressed={lang === key}
                    onClick={() => setLang(key)}
                    className={cn(
                      'rounded-full px-2.5 py-0.5 text-[12px] font-medium transition-colors',
                      lang === key
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
            <div className='max-h-[240px] overflow-y-auto overscroll-contain pr-2 text-[13px] leading-relaxed whitespace-pre-wrap text-foreground/85 [scrollbar-width:thin]'>
              {text}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
