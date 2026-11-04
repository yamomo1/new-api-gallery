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
 * 提示词里的 @ 引用（@图片1 / @视频1 / @音频1）
 * ------------------------------------------------------------------
 * 在输入框里打 `@` 就弹出一个小面板，列出当前已上传的素材；
 * 继续打字（比如 `@1`）按编号过滤；鼠标悬浮高亮、点击（或回车）插入。
 *
 * 统一入口是 `MentionTextarea`：图片页、视频页都用它，交互完全一致。
 * `useMention` 保留导出，供需要自定义 textarea 外观/布局的场景复用。
 *
 * 为什么做成 hook + 受控面板而不是 contenteditable：
 * 需求只是「往文本里插一段字符」，受控 textarea + 光标计算足够，
 * 换 contenteditable 会把粘贴、输入法、撤销全搞乱。
 *
 * 触发规则（2026-11-04 修正）：
 *   旧规则要求 `@` 前面必须是行首/空白/左括号，于是
 *   `@图片1 AAA@`、`@@`、`AAA@` 这些「不是空格式分隔」的场景全都弹不出来。
 *   现在改成：从光标往前找最近的 `@`，只要 `@` 与光标之间没有空白、
 *   且字符数不超上限，就认为正在输入引用 —— 不再关心 `@` 前面是什么。
 *   判定逻辑见 `lib/mention-trigger.ts`（纯函数，可单测）。
 *   插入后的完整引用是 `@图片1 `（带尾空格），所以光标停在其后时
 *   最近的 `@` 与光标之间隔着空格 → 不会重复弹出。
 */
import { useMemo, useRef, useState } from 'react'

import { cn } from '@/lib/utils'
import {
  findMentionTrigger,
  type MentionTrigger,
} from './lib/mention-trigger'

export type MentionType = 'image' | 'video' | 'audio' | 'frame'

export type MentionItem = {
  /** 唯一键（用素材 id） */
  key: string
  /** 插入到文本里的词，如「图片1」 */
  label: string
  type: MentionType
  /** 缩略图（图片/视频封面），音频可空 */
  thumb?: string
}

export function useMention({
  items,
  value,
  setValue,
  inputRef,
}: {
  items: MentionItem[]
  value: string
  setValue: (next: string) => void
  inputRef: React.RefObject<HTMLTextAreaElement | null>
}) {
  const [state, setState] = useState<MentionTrigger | null>(null)
  const [index, setIndex] = useState(0)

  const filtered = useMemo(() => {
    if (!state) return []
    const q = state.query.trim()
    if (!q) return items
    // 「@1」能命中「图片1」，也允许用中文全名过滤
    return items.filter((it) => it.label.includes(q))
  }, [items, state])

  const open = Boolean(state) && filtered.length > 0

  /** 每次输入后同步一次：文本 + 光标位置都由调用方给，避免读到旧 value */
  const sync = (text: string, caret: number) => {
    const hit = findMentionTrigger(text, caret)
    if (!hit) {
      setState(null)
      return
    }
    // 查询串没变时不要重建 state，否则每次输入都重置高亮项
    setState((prev) =>
      prev && prev.start === hit.start && prev.query === hit.query
        ? { ...hit, end: hit.end }
        : hit
    )
    setIndex(0)
  }

  const close = () => setState(null)

  const pick = (item: MentionItem) => {
    if (!state) return
    const el = inputRef.current
    const inserted = `@${item.label} `
    // 用 state.end 而不是实时 selectionStart：点面板时 textarea 已失焦，
    // 有些浏览器此时 selectionStart 会归零，替换范围就错了
    const next =
      value.slice(0, state.start) + inserted + value.slice(state.end)
    setValue(next)
    setState(null)
    // 等 React 把新值刷进 textarea 再定位光标，否则会被重置到末尾
    requestAnimationFrame(() => {
      const pos = state.start + inserted.length
      el?.focus()
      el?.setSelectionRange(pos, pos)
    })
  }

  /** 返回 true 表示这次按键已被面板吃掉 */
  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!open) return false
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setIndex((i) => (i + 1) % filtered.length)
      return true
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setIndex((i) => (i - 1 + filtered.length) % filtered.length)
      return true
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      pick(filtered[index])
      return true
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      close()
      return true
    }
    return false
  }

  return {
    open,
    items: filtered,
    index,
    setIndex,
    pick,
    sync,
    close,
    onKeyDown,
  }
}

const TYPE_LABEL: Record<MentionType, string> = {
  image: '图',
  video: '视',
  audio: '音',
  frame: '帧',
}

export function MentionMenu({
  open,
  items,
  index,
  onHover,
  onPick,
}: {
  open: boolean
  items: MentionItem[]
  index: number
  onHover: (i: number) => void
  onPick: (item: MentionItem) => void
}) {
  if (!open) return null
  return (
    <div
      data-mention-menu='true'
      className='ymm-glass-menu absolute bottom-full left-0 z-50 mb-2 w-[236px] rounded-[12px] p-1.5'
    >
      <div className='text-muted-foreground px-2 pt-1 pb-1.5 text-[11px]'>
        引用素材 · 悬浮选中，点击或回车插入
      </div>
      <div className='max-h-[208px] overflow-y-auto'>
        {items.map((item, i) => (
          <button
            key={item.key}
            type='button'
            // 用 mousedown 抢在 textarea 失去焦点之前插入
            onMouseDown={(event) => {
              event.preventDefault()
              onPick(item)
            }}
            onMouseEnter={() => onHover(i)}
            className={cn(
              'ymm-dd-item flex w-full items-center gap-2 rounded-[8px] px-2 py-1.5 text-left text-[13px]',
              i === index && 'bg-foreground/10'
            )}
          >
            {item.thumb ? (
              <img
                src={item.thumb}
                alt=''
                className='size-6 shrink-0 rounded-[5px] object-cover'
              />
            ) : (
              <span className='bg-muted text-muted-foreground flex size-6 shrink-0 items-center justify-center rounded-[5px] text-[10px]'>
                {TYPE_LABEL[item.type]}
              </span>
            )}
            <span className='text-foreground truncate'>{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

/**
 * 带 @ 引用的输入框 —— 全站统一入口。
 * 图片页 / 视频页都用它，避免两处各写一遍事件绑定（以前就是这样，
 * 一改触发规则就得改两个文件，容易漏）。
 */
export function MentionTextarea({
  value,
  onChange,
  items,
  placeholder,
  rows = 3,
  className,
}: {
  value: string
  onChange: (next: string) => void
  items: MentionItem[]
  placeholder?: string
  rows?: number
  className?: string
}) {
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const mention = useMention({ items, value, setValue: onChange, inputRef })

  return (
    <div className='relative'>
      <MentionMenu
        open={mention.open}
        items={mention.items}
        index={mention.index}
        onHover={mention.setIndex}
        onPick={mention.pick}
      />
      <textarea
        ref={inputRef}
        value={value}
        onChange={(event) => {
          onChange(event.target.value)
          mention.sync(event.target.value, event.target.selectionStart ?? 0)
        }}
        onKeyDown={(event) => {
          mention.onKeyDown(event)
        }}
        onBlur={mention.close}
        placeholder={placeholder}
        rows={rows}
        className={cn(
          'text-foreground placeholder:text-muted-foreground/70 mt-2.5 min-h-[72px] w-full resize-none bg-transparent text-sm leading-[1.6] outline-none',
          className
        )}
      />
    </div>
  )
}
