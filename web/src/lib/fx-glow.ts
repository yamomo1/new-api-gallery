/**
 * 「鼠标跟随光晕」驱动器（借鉴 aliyun.com 2025 首页 .effect-highlight 的实现思路）
 * ------------------------------------------------------------------
 * CSS 侧：元素带 .fx-glow，::before 用 --mouse-x/--mouse-y 定位一枚
 *         radial 光斑（mix-blend-mode: overlay），hover 时浮现。
 * JS 侧：本模块监听全局 pointermove（单例，passive），把光标相对
 *        最近 .fx-glow 祖先的坐标写进 CSS 变量，光斑即跟手。
 *
 * 用法：给需要光晕的元素加 `fx-glow` 类，并在任意已挂载组件里调用
 *       一次 ensureFxGlowBound()（内部幂等，重复调用无害）。
 */
let bound = false

export function ensureFxGlowBound(): void {
  if (bound || typeof window === 'undefined') return
  bound = true
  window.addEventListener(
    'pointermove',
    (e: PointerEvent) => {
      const target = e.target as Element | null
      const host = target?.closest?.<HTMLElement>('.fx-glow')
      if (!host) return
      const rect = host.getBoundingClientRect()
      host.style.setProperty('--mouse-x', `${Math.round(e.clientX - rect.left)}px`)
      host.style.setProperty('--mouse-y', `${Math.round(e.clientY - rect.top)}px`)
    },
    { passive: true },
  )
}
