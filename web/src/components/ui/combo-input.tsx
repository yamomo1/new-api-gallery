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
 * 可输入的下拉：既有预设选项，也允许自由输入
 * ------------------------------------------------------------------
 * 模型名和标签都是「大部分来自固定清单、少部分是新的」这种数据，
 * 纯 select 会挡住新值，纯 input 又让人每次手打。这个组件两者兼顾：
 * - 点击展开预设列表（带本地过滤）
 * - 直接输入则使用输入值，回车确认
 * - 输入与预设完全一致时高亮那一项
 */
import { useMemo, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type Props = {
  value: string
  onChange: (value: string) => void
  options: string[]
  placeholder?: string
  /** 关闭时是否允许任意输入（标签一般开启，模型名一般也开启） */
  allowCustom?: boolean
  className?: string
}

export function ComboInput({
  value,
  onChange,
  options,
  placeholder,
  allowCustom = true,
  className,
}: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // 输入框内容既可能是「正在搜索」，也可能是「已定的值」。
  // 用 focus 状态区分：聚焦时按 query 过滤，失焦时显示 value。
  const keyword = (open ? query : value).trim().toLowerCase()

  const filtered = useMemo(() => {
    if (!keyword) return options
    return options.filter((o) => o.toLowerCase().includes(keyword))
  }, [options, keyword])

  const commit = (next: string) => {
    onChange(next)
    setQuery('')
    setOpen(false)
  }

  return (
    <div className={cn('flex gap-1.5', className)}>
      <div className='relative flex-1'>
        <Input
          ref={inputRef}
          value={open ? query : value}
          placeholder={placeholder}
          readOnly={!allowCustom}
          onChange={(e) => {
            setQuery(e.target.value)
            if (!open) setOpen(true)
            if (allowCustom) onChange(e.target.value)
          }}
          onFocus={() => {
            setQuery('')
            setOpen(true)
          }}
          onBlur={() => {
            // 延迟关闭，让下拉项的 click 先触发
            setTimeout(() => setOpen(false), 150)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              if (allowCustom) commit(query.trim() || value)
              else if (filtered.length > 0) commit(filtered[0])
            } else if (e.key === 'Escape') {
              setOpen(false)
            }
          }}
          className='pr-8'
        />
        <Button
          type='button'
          variant='ghost'
          size='icon-sm'
          className='absolute right-0.5 top-1/2 -translate-y-1/2'
          onClick={() => {
            setQuery('')
            setOpen((v) => !v)
            inputRef.current?.focus()
          }}
          tabIndex={-1}
        >
          <ChevronDown className='size-3.5 opacity-60' />
        </Button>

        {open && filtered.length > 0 && (
          <div className='absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-y-auto rounded-md border bg-popover p-1 shadow-md'>
            {filtered.map((opt) => (
              <button
                key={opt}
                type='button'
                // 用 onMouseDown 抢在 input 的 blur 之前
                onMouseDown={(e) => {
                  e.preventDefault()
                  commit(opt)
                }}
                className='flex w-full items-center gap-1.5 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent'
              >
                <Check
                  className={cn(
                    'size-3.5 shrink-0',
                    opt === value ? 'opacity-100' : 'opacity-0'
                  )}
                />
                <span className='truncate'>{opt}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/** 给已选值画一排可删除的小 chip（标签用） */
export function ValueChips({
  values,
  onRemove,
}: {
  values: string[]
  onRemove: (value: string) => void
}) {
  if (values.length === 0) return null
  return (
    <div className='flex flex-wrap gap-1.5'>
      {values.map((v) => (
        <span
          key={v}
          className='inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground'
        >
          {v}
          <button
            type='button'
            onClick={() => onRemove(v)}
            className='text-muted-foreground/60 hover:text-destructive'
            aria-label={`Remove ${v}`}
          >
            ×
          </button>
        </span>
      ))}
    </div>
  )
}
