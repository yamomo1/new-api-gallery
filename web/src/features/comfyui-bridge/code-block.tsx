import { Check, Copy, Terminal } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

type CodeBlockProps = {
  /** 完整可复制的文本（含换行） */
  code: string
  /** 左上角用途标签，如 bash / 启动日志 */
  label?: string
  /** 是否展示行首的终端提示符样式（只影响展示，不影响复制内容） */
  className?: string
}

/**
 * 深色终端风代码块。
 * ------------------------------------------------------------------
 * 固定深色：代码/日志在浅色主题下用白底反而更难读，终端也天然是深色，
 * 所以这里不跟随主题反转，只用语义化的中性色阶。
 */
export function CodeBlock({ code, label, className }: CodeBlockProps) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setCopied(false), 1800)
    } catch {
      // 非安全上下文或用户拒绝剪贴板权限时静默失败：
      // 文本本身可选中，不阻断用户手动复制。
    }
  }, [code])

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950',
        className
      )}
    >
      <div className='flex items-center justify-between border-b border-neutral-800 px-3.5 py-2'>
        <div className='flex items-center gap-1.5 text-[11px] tracking-wide text-neutral-500'>
          <Terminal className='size-3' />
          <span className='font-mono uppercase'>{label || 'shell'}</span>
        </div>
        <button
          type='button'
          onClick={copy}
          aria-label={t('Copy', { defaultValue: '复制' })}
          className={cn(
            'inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px]',
            'text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-neutral-100',
            'focus-visible:ring-2 focus-visible:ring-neutral-500 focus-visible:outline-none'
          )}
        >
          {copied ? (
            <>
              <Check className='size-3 text-emerald-400' />
              <span className='text-emerald-400'>
                {t('Copied', { defaultValue: '已复制' })}
              </span>
            </>
          ) : (
            <>
              <Copy className='size-3' />
              <span>{t('Copy', { defaultValue: '复制' })}</span>
            </>
          )}
        </button>
      </div>
      <pre className='overflow-x-auto px-3.5 py-3 text-[12.5px] leading-relaxed'>
        <code className='font-mono text-neutral-300'>{code}</code>
      </pre>
    </div>
  )
}
