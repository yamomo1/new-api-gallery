/**
 * 滚动进入视口出现动画（scroll-reveal）—— 首页与画布落地页共用
 * ------------------------------------------------------------------
 * 两种挂法：
 *   1) [data-reveal]        单个元素淡入上浮，data-reveal-delay（毫秒）错峰
 *   2) [data-reveal-group]  盒子级：内部「直接子元素」自动逐个挂动画，
 *                           data-reveal-step（默认 110ms）控制相邻间隔，最多累积 8 步
 *
 * 只动 opacity / transform / filter，卡片自身 hover 过渡不受影响。
 * 对应样式见 gallery-home.css / canvas-landing.css 的 [data-reveal] 段。
 */
import type { DependencyList } from 'react'
import { useEffect } from 'react'

export function useScrollReveal(
  rootSelector: string,
  deps: DependencyList = [],
): void {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(rootSelector)
    if (!root) return

    // 无 IntersectionObserver（极老浏览器 / 非浏览器环境）：不藏元素，直接显示
    if (typeof IntersectionObserver === 'undefined') {
      root.classList.add('no-io')
      return
    }

    // 1) 把「盒子」展开成逐个子元素
    root.querySelectorAll<HTMLElement>('[data-reveal-group]').forEach((group) => {
      const step = Number(group.dataset.revealStep || 110)
      Array.from(group.children).forEach((child, i) => {
        const el = child as HTMLElement
        // 子元素自己已声明 reveal / 也是新的盒子 → 交给它自己处理，避免父子上浮动效叠加
        if (el.hasAttribute('data-reveal') || el.hasAttribute('data-reveal-group')) {
          return
        }
        el.setAttribute('data-reveal', '')
        if (!el.dataset.revealDelay) {
          el.style.setProperty('--rd', `${Math.min(i * step, step * 8)}ms`)
        }
      })
    })

    // 2) 统一观察所有待出现元素
    const els = Array.from(root.querySelectorAll<HTMLElement>('[data-reveal]'))
    if (els.length === 0) return

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('in')
            io.unobserve(e.target)
          }
        }
      },
      { threshold: 0.1, rootMargin: '0px 0px -8% 0px' },
    )

    els.forEach((el) => {
      const d = el.dataset.revealDelay
      if (d) el.style.setProperty('--rd', `${d}ms`)
      if (!el.classList.contains('in')) io.observe(el)
    })

    return () => io.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
