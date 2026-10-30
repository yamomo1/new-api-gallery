// ----------------------------------------------------------------------------
// 瀑布流基础工具（设计规范 §8.7 / §8.8）
// ----------------------------------------------------------------------------
//
// 分列算法本身在 components/masonry-grid.tsx 里（需要直接操作 DOM 量高度）。
// 这里只放两类纯函数：断点算列数、封面高度派生。

/** 卡片间距（px），累加列高时的间隙估算，也是 flex gap 的值 */
export const MASONRY_GAP = 24

/** 断点 → 列数（规范：桌面 4 列 → 1100px 3 列 → 760px 2 列 → 440px 1 列） */
export function getColumnCount(width: number): number {
  if (width < 440) return 1
  if (width < 760) return 2
  if (width < 1100) return 3
  return 4
}

/**
 * 封面高度档位（规范要求 180–300px 不等高，制造天然错落）。
 * 用作品 id 派生而不是随机数：同一作品每次渲染高度一致，不会抖动。
 */
const COVER_HEIGHTS = [180, 205, 230, 255, 280, 300] as const

export function coverHeight(id: number): number {
  // Knuth 乘法散列，避免相邻 id 落到同一档位导致"整列一样高"
  const hashed = Math.abs(Math.trunc(id * 2654435761)) >>> 0
  return COVER_HEIGHTS[hashed % COVER_HEIGHTS.length]
}
