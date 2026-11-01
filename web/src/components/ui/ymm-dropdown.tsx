/*
 * 下拉选择 —— 记忆规范 DESIGN-SYSTEM-YMM §I 的 .ymm-dd 体系
 *
 * 规范要求（全部由 styles/ymm-dd.css + theme.css 的派生令牌实现，本文件只组结构）：
 * - 触发器：半透明卡片底 82% + blur(12px)、1px 描边、圆角 10、13px 文字、柔阴影
 * - 打开：主色 40% 描边 + 3px 主色聚焦环，箭头旋转 180°
 * - 菜单：磨砂玻璃（86% + blur20 saturate1.4）、圆角 14、内边距 6、双层阴影
 * - 菜单项：13px / 圆角 9 / padding 9-12；hover 主色柔底 + 主色字 + 右移 2px；
 *   选中 600 字重 + 右侧 ✓
 *
 * 任何下拉、浮层都应该用这里的组件或 .ymm-dd* 类，不要另写一套白底实心样式。
 */
import { ChevronDown } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'

import { cn } from '@/lib/utils'

export type YmmAlign = 'start' | 'end'
export type YmmSide = 'down' | 'up'

/** 开合状态 + 外点/Esc 关闭。返回 ref 必须挂在根节点上。 */
export function useYmmDropdown() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return { open, setOpen, ref }
}

/** 菜单面板的类名（磨砂玻璃 + 方向/对齐/滚动修饰） */
export function ymmMenuClass({
  align = 'end',
  side = 'down',
  scroll = false,
  className,
}: {
  align?: YmmAlign
  side?: YmmSide
  scroll?: boolean
  className?: string
} = {}) {
  return cn(
    'ymm-dd-menu ymm-glass-menu',
    align === 'start' && 'ymm-dd-menu--start',
    side === 'up' && 'ymm-dd-menu--up',
    scroll && 'ymm-dd-menu--scroll',
    className
  )
}

export type YmmOption = { value: string; label: string }

/**
 * 标准下拉：触发器 = 可选前置图标 + 当前值 + 箭头；菜单 = 半透明磨砂 + 选中 ✓
 */
export function YmmDropdown({
  value,
  options,
  onChange,
  placeholder = '全部',
  align = 'end',
  side = 'down',
  scroll = false,
  icon,
  className,
  buttonClassName,
  ariaLabel,
}: {
  value: string
  options: YmmOption[]
  onChange: (value: string) => void
  placeholder?: string
  align?: YmmAlign
  side?: YmmSide
  scroll?: boolean
  icon?: ReactNode
  className?: string
  buttonClassName?: string
  ariaLabel?: string
}) {
  const { open, setOpen, ref } = useYmmDropdown()
  const current = options.find((o) => o.value === value)

  return (
    <div ref={ref} className={cn('ymm-dd', open && 'open', className)}>
      <button
        type='button'
        className={cn('ymm-dd-btn', buttonClassName)}
        aria-haspopup='listbox'
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((v) => !v)}
      >
        {icon}
        <span className='ymm-dd-label'>{current?.label ?? placeholder}</span>
        <ChevronDown className='chev size-3.5' />
      </button>

      <div
        className={ymmMenuClass({ align, side, scroll })}
        role='listbox'
        aria-label={ariaLabel}
      >
        {options.map((opt) => (
          <button
            key={opt.value || '__all__'}
            type='button'
            role='option'
            aria-selected={opt.value === value}
            className={cn('ymm-dd-item', opt.value === value && 'selected')}
            onClick={() => {
              onChange(opt.value)
              setOpen(false)
            }}
          >
            <span className='truncate'>{opt.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
