import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

import { getColumnCount, MASONRY_GAP } from '../hooks/use-masonry'

type MasonryGridProps<T> = {
  items: T[]
  /** 稳定 key，React 复用与 ref 注册都靠它 */
  getKey: (item: T) => string | number
  /** 渲染单张卡片。必须把 ref 透传到卡片根节点，否则无法测量高度 */
  renderItem: (item: T, index: number, ref: (el: HTMLElement | null) => void) => React.ReactNode
  /** 额外的重排触发依赖（筛选条件 / 排序等） */
  deps?: unknown[]
  className?: string
  /** 卡片未挂载时的估算高度，仅用于首帧分列，随后会被真实高度覆盖 */
  estimateHeight?: number
}

/**
 * 瀑布流容器（设计规范 §8.7 / §8.8）
 * ------------------------------------------------------------------
 * 为什么不用 CSS `columns` / Tailwind `columns-*`：
 *   多列流是「纵向填充 + 自动平衡列高」的模型。任意一张卡高度变化
 *   （图片加载完成、hover 展开信息面板）都会触发跨列重平衡 → 整页卡片闪跳。
 *
 * 本组件的做法：
 *   ① 量出每张卡的当前高度；
 *   ② 逐张放进「当前累计高度最矮」的那一列（经典 masonry 贪心）；
 *   ③ 渲染成 N 个 flex 纵向列。
 *   展开面板撑开时卡片变高 → 重排仍只在列内发生，绝不跨列。
 *
 * 关键实现细节：卡片节点用 Map 按 key 存，**不依赖渲染顺序**。
 * 若用数组下标存 ref，重排时 React 复用节点会让 ref 与数据错位，
 * 高度测量随即出错、列高失衡 —— 这是手写 masonry 最常见的坑。
 */
export function MasonryGrid<T>({
  items,
  getKey,
  renderItem,
  deps = [],
  className,
  estimateHeight = 240,
}: MasonryGridProps<T>) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const nodeMap = useRef(new Map<string | number, HTMLElement>())
  const [columns, setColumns] = useState(4)
  const [buckets, setBuckets] = useState<T[][]>(() => Array.from({ length: 4 }, () => []))

  const setNode = useCallback(
    (key: string | number) => (el: HTMLElement | null) => {
      if (el) nodeMap.current.set(key, el)
      else nodeMap.current.delete(key)
    },
    []
  )

  /** 按最短列贪心分列 */
  const relayout = useCallback(
    (n: number) => {
      const cols: T[][] = Array.from({ length: n }, () => [])
      if (!items.length) {
        setBuckets(cols)
        return
      }
      const heights: number[] = Array.from({ length: n }, () => 0)
      for (const item of items) {
        const el = nodeMap.current.get(getKey(item))
        // 卡片可能尚未挂载（首帧），用估算值兜底，下一帧会被真实高度修正
        const h = el ? el.getBoundingClientRect().height : estimateHeight
        let target = 0
        for (let c = 1; c < n; c++) {
          if (heights[c] < heights[target]) target = c
        }
        cols[target].push(item)
        heights[target] += h + MASONRY_GAP
      }
      // 内容没变就不触发重渲染，避免 ResizeObserver 抖动成死循环
      setBuckets((prev) => (isSameBuckets(prev, cols, getKey) ? prev : cols))
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, estimateHeight, getKey]
  )

  /* 容器宽度 → 列数（建一次 ResizeObserver） */
  useLayoutEffect(() => {
    const root = containerRef.current
    if (!root) return
    const measure = () => {
      const next = getColumnCount(root.clientWidth)
      setColumns((prev) => (prev === next ? prev : next))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(root)
    return () => ro.disconnect()
  }, [])

  /* 列数 / 卡片集合 / 外部依赖变化 → 重排 */
  useLayoutEffect(() => {
    relayout(columns)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columns, items, ...deps])

  /* 卡片高度变化（图片加载、展开面板、字体回流）→ 节流重排 */
  useEffect(() => {
    const root = containerRef.current
    if (!root) return

    let raf = 0
    const schedule = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => relayout(columns))
    }

    const ro = new ResizeObserver(schedule)
    // 只观察当前已挂载的卡片节点
    nodeMap.current.forEach((el) => ro.observe(el))

    // 图片懒加载完成会改变高度，补一次监听
    root.addEventListener('load', schedule, true)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      root.removeEventListener('load', schedule, true)
    }
    // items 变化后节点会重建，需要重新 observe
  }, [columns, items, relayout])

  return (
    <div
      ref={containerRef}
      className={className}
      data-masonry-columns={columns}
      style={{ display: 'flex', alignItems: 'flex-start', gap: MASONRY_GAP }}
    >
      {buckets.map((col, ci) => (
        <div
          // 列号是固定维度的结构性标识（不是列表项），用序号做 key 是正确语义
          // eslint-disable-next-line react/no-array-index-key
          key={ci}
          style={{
            flex: '1 1 0',
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: MASONRY_GAP,
          }}
        >
          {col.map((item) => (
            <div key={getKey(item)} data-masonry-item>
              {renderItem(item, 0, setNode(getKey(item)))}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

/** 比较两次分列结果是否完全一致（按 key 序列） */
function isSameBuckets<T>(
  a: T[][],
  b: T[][],
  getKey: (item: T) => string | number
): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    const x = a[i]
    const y = b[i]
    if (x.length !== y.length) return false
    for (let j = 0; j < x.length; j++) {
      if (getKey(x[j]) !== getKey(y[j])) return false
    }
  }
  return true
}
