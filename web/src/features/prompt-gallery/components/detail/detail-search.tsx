import { useNavigate } from '@tanstack/react-router'
import { Search } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

/**
 * 详情页顶部搜索框
 * ---------------------------------------------------------------
 * 回车/提交跳到提示词画廊并带上关键词（/prompt-gallery?search=xxx），
 * 与列表页现有的搜索状态共用同一套筛选参数，不另起一套检索逻辑。
 */
export function DetailSearch({ className }: { className?: string }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [value, setValue] = useState('')

  return (
    <form
      role='search'
      onSubmit={(event) => {
        event.preventDefault()
        const keyword = value.trim()
        void navigate({
          to: '/prompt-gallery',
          search: keyword ? { search: keyword } : {},
        })
      }}
      className={cn('relative', className)}
    >
      <Search className='pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground/70' />
      <input
        type='search'
        value={value}
        onChange={(event) => setValue(event.target.value)}
        aria-label={t('Search prompts')}
        placeholder={t('Search prompts, models, or creators', {
          defaultValue: '搜索提示词、模型或作者',
        })}
        className='h-9 w-full rounded-full border border-border/70 bg-card pr-3 pl-10 text-[13px] text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary/50 focus:ring-2 focus:ring-primary/10'
      />
    </form>
  )
}
