import { useTranslation } from 'react-i18next'
import { Check, Copy, ExternalLink } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { runningHubInviteUrl } from '@/features/canvas/runninghub'
import { cn } from '@/lib/utils'

import type { PromptGalleryItem } from '../types'
import { copyText } from '../utils'

/**
 * 提示词展示块：双语（英文/中文）Tab + 使用此提示 + 复制 + 去 RunningHub 试。
 * 详情弹窗与详情页（/prompt-gallery/:id）共用，避免两处逻辑漂移。
 */
export function PromptBlock({ item }: { item: PromptGalleryItem }) {
  const { t } = useTranslation()
  const bilingual = Boolean(item.prompt_en && item.prompt_en.trim())
  const [lang, setLang] = useState<'en' | 'zh'>('en')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setCopied(false)
    setLang('en')
  }, [item.id])

  const text = bilingual && lang === 'en' ? item.prompt_en! : item.prompt

  const handleCopy = async () => {
    const ok = await copyText(text)
    if (ok) {
      setCopied(true)
      toast.success(t('Prompt copied'))
      setTimeout(() => setCopied(false), 1500)
    } else {
      toast.error(t('Copy failed'))
    }
  }

  return (
    <div className='rounded-2xl border border-border bg-muted/40 p-4'>
      <div className='mb-3 flex items-center justify-between gap-2'>
        {bilingual ? (
          <div className='inline-flex rounded-full bg-muted p-0.5'>
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
                  'rounded-full px-3.5 py-1 text-[13px] font-medium transition-colors',
                  lang === key
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {label}
              </button>
            ))}
          </div>
        ) : (
          <span className='text-sm font-semibold'>{t('Prompt')}</span>
        )}
        <div className='flex items-center gap-1'>
          <Button
            size='sm'
            className='h-7 gap-1 rounded-full px-3 text-xs'
            onClick={handleCopy}
          >
            {t('Use this prompt')}
          </Button>
          <Button
            variant='ghost'
            size='sm'
            className='h-7 w-7 p-0'
            aria-label={t('Copy Prompt')}
            title={t('Copy Prompt')}
            onClick={handleCopy}
          >
            {copied ? <Check className='size-3.5' /> : <Copy className='size-3.5' />}
          </Button>
        </div>
      </div>
      <p className='max-h-64 overflow-y-auto text-sm leading-relaxed whitespace-pre-wrap text-foreground/90'>
        {text}
      </p>
      {/* 外链走 runningHubInviteUrl 单一真源，始终带推广码；勿手拼 URL */}
      <div className='mt-3 flex items-center justify-end'>
        <a
          href={runningHubInviteUrl()}
          target='_blank'
          rel='noopener noreferrer'
          title={t('Opens RunningHub in a new tab with your invite code')}
          onClick={() => {
            // 顺手把当前语种的提示词塞进剪贴板，新窗口里直接粘贴，少一步复制
            void copyText(text)
          }}
          className='inline-flex items-center gap-1 text-xs font-medium text-primary transition-colors hover:text-primary/80'
        >
          <ExternalLink className='size-3.5' />
          {t('Try on RunningHub')}
        </a>
      </div>
    </div>
  )
}
