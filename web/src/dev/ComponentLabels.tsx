/*
 * 本地开发辅助：组件标注叠加层（dev-only）
 *
 * 设计约束（与用户约定）：
 *  - 仅在 import.meta.env.DEV 下挂载；生产构建会被 tree-shake 剔除，零运行时侵入。
 *  - 用独立的 React root 渲染，不包裹任何业务组件，不改业务 DOM 树、不改业务逻辑。
 *  - 叠加层 pointer-events:none（仅徽标与控制条可点），绝不拦截页面原有交互。
 *  - 实时同步：MutationObserver(childList+subtree) 监听任意 DOM 变化（含 SPA 路由切换、
 *    弹窗开关、列表增删），配合 scroll/resize 与 rAF 重定位。
 */

import { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'

const DEV_ROOT_ID = '__dev_cl_root__'
const OVERLAY_ID = '__dev_cl_overlay__'
const STYLE_ID = '__dev_cl_style__'
const TOAST_ID = '__dev_cl_toast__'

// 默认只标注"组件级"元素，避免把每一个 <span>/<div> 都标出来造成噪声。
// 用户可在控制条「设置」里自由增删任意 CSS selector。
const DEFAULT_SELECTOR = [
  '[data-component]',
  '[data-testid]',
  'main',
  'section',
  'header',
  'nav',
  'footer',
  'aside',
  'article',
  'form',
  '[role="dialog"]',
  '[role="menu"]',
  '[role="tablist"]',
  '[role="listbox"]',
  '.card',
  '.panel',
  '.modal',
  '.dialog',
  '.drawer',
  '.popover',
  '[class*="Card"]',
  '[class*="Panel"]',
  '[class*="Modal"]',
  '[class*="Dialog"]',
  '[class*="Section"]',
  '[class*="Page"]',
  '[class*="View"]',
  '[class*="Toolbar"]',
  '[class*="Menu"]',
  '[class*="Tabs"]',
  '[class*="List"]',
].join(',')

function setStyle(el: HTMLElement, s: Record<string, string>) {
  Object.assign(el.style, s)
}

// 过滤掉 CSS Modules / CSS-in-JS 生成的哈希类名，只保留可读的语义类名
function meaningfulClasses(el: Element): string[] {
  const list = Array.from(el.classList || [])
  return list
    .filter(
      (c) =>
        /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(c) &&
        !/^(css|sc|chakra|Mui|ant-|ymm-)/.test(c)
    )
    .slice(0, 2)
}

// 生成稳定、可读的 CSS 路径（用于复制给开发者的定位描述）
function cssPath(el: Element, maxDepth = 6): string {
  const parts: string[] = []
  let node: Element | null = el
  let depth = 0
  while (
    node &&
    node !== document.body &&
    node !== document.documentElement &&
    depth < maxDepth
  ) {
    let seg = node.tagName.toLowerCase()
    if (node.id) {
      const last = node.id.split(/[-_]/).filter(Boolean).pop() || node.id
      seg += '#' + last
      parts.unshift(seg)
      break
    }
    const mc = meaningfulClasses(node)
    if (mc.length) seg += '.' + mc.join('.')
    const parent: HTMLElement | null = node.parentElement
    if (parent) {
      const siblings: Element[] = Array.from(parent.children).filter(
        (c: Element) => c.tagName === node!.tagName
      )
      if (siblings.length > 1) {
        seg += `:nth-of-type(${siblings.indexOf(node as Element) + 1})`
      }
    }
    parts.unshift(seg)
    node = parent
    depth++
  }
  return parts.join(' > ')
}

interface Entry {
  el: Element
  id: number
  path: string
  name: string
}

function scan(
  selector: string,
  pathToId: Map<string, number>,
  nextId: { v: number }
): Entry[] {
  let nodes: Element[] = []
  try {
    nodes = Array.from(document.querySelectorAll(selector))
  } catch {
    return []
  }
  const out: Entry[] = []
  for (const el of nodes) {
    if (el.closest('#' + DEV_ROOT_ID)) continue
    if (el === document.body || el === document.documentElement) continue
    const rect = el.getBoundingClientRect()
    if (rect.width === 0 && rect.height === 0) continue
    const path = cssPath(el)
    let id = pathToId.get(path)
    if (id === undefined) {
      id = nextId.v++
      pathToId.set(path, id)
    }
    const name =
      el.getAttribute('data-component') || el.getAttribute('data-testid') || ''
    out.push({ el, id, path, name })
  }
  // 按编号排序，便于自上而下阅读
  out.sort((a, b) => a.id - b.id)
  return out
}

let toastTimer: number | undefined
function showToast(msg: string) {
  let t = document.getElementById(TOAST_ID)
  if (!t) {
    t = document.createElement('div')
    t.id = TOAST_ID
    setStyle(t, {
      position: 'fixed',
      bottom: '60px',
      left: '12px',
      zIndex: '2147483647',
      background: 'rgba(15,18,28,.92)',
      color: '#e8e8ef',
      padding: '8px 12px',
      borderRadius: '8px',
      fontSize: '12px',
      fontFamily: 'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace',
      maxWidth: '72vw',
      pointerEvents: 'none',
      border: '1px solid rgba(255,255,255,.18)',
      transition: 'opacity .2s ease',
    })
    document.body.appendChild(t)
  }
  t.textContent = msg
  t.style.opacity = '1'
  if (toastTimer) window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => {
    if (t) t.style.opacity = '0'
  }, 1500)
}

const CSS = `
.__dev_cl_badge__{
  position:absolute; top:0; left:0;
  font:600 11px/1.2 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
  color:#aef5c8; background:rgba(15,18,28,.82);
  border:1px solid rgba(255,255,255,.22); border-radius:5px;
  padding:2px 6px; white-space:nowrap; pointer-events:auto; cursor:pointer;
  transform:translate(0,0); will-change:transform;
  box-shadow:0 1px 4px rgba(0,0,0,.35); letter-spacing:.2px;
}
.__dev_cl_badge__:hover{ color:#fff; border-color:rgba(255,255,255,.55); z-index:1; }
.__dev_cl_bar__{
  position:fixed; left:12px; bottom:12px; z-index:2147483647;
  display:flex; gap:8px; align-items:center; padding:8px 10px;
  background:rgba(15,18,28,.9); border:1px solid rgba(255,255,255,.16);
  border-radius:10px; color:#e8e8ef;
  font:13px/1 ui-monospace,system-ui,sans-serif; backdrop-filter:blur(6px);
}
.__dev_cl_bar__ button{
  font:13px/1 inherit; color:#e8e8ef; background:rgba(255,255,255,.08);
  border:1px solid rgba(255,255,255,.18); border-radius:7px; padding:6px 10px; cursor:pointer;
}
.__dev_cl_bar__ button:hover{ background:rgba(255,255,255,.16); }
.__dev_cl_bar__ .cnt{ opacity:.7; }
.__dev_cl_panel__{
  position:fixed; left:12px; bottom:56px; z-index:2147483647; width:360px;
  background:rgba(15,18,28,.95); border:1px solid rgba(255,255,255,.18);
  border-radius:10px; padding:12px; color:#e8e8ef;
  font:12px/1.5 ui-monospace,system-ui,sans-serif;
}
.__dev_cl_panel__ textarea{
  width:100%; height:96px; resize:vertical; background:rgba(0,0,0,.35);
  color:#cfe; border:1px solid rgba(255,255,255,.2); border-radius:7px; padding:6px;
  font:12px/1.4 ui-monospace,monospace; box-sizing:border-box;
}
.__dev_cl_panel__ .row{ display:flex; gap:8px; margin-top:8px; flex-wrap:wrap; }
.__dev_cl_panel__ .row button{
  flex:1; min-width:120px; font:12px/1 inherit; color:#e8e8ef; background:rgba(255,255,255,.08);
  border:1px solid rgba(255,255,255,.18); border-radius:7px; padding:7px; cursor:pointer;
}
.__dev_cl_panel__ h4{ margin:0 0 6px; font-size:12px; opacity:.85; }
.__dev_cl_panel__ p{ margin:8px 0 0; opacity:.65; font-size:11px; }
`

interface Engine {
  start(): void
  stop(): void
  setSelector(s: string): void
  setVisible(v: boolean): void
  getMapping(): Record<string, string>
}

function createEngine(opts: {
  getVisible: () => boolean
  onCount: (n: number) => void
}): Engine {
  const overlay = document.createElement('div')
  overlay.id = OVERLAY_ID
  setStyle(overlay, {
    position: 'fixed',
    inset: '0',
    pointerEvents: 'none',
    zIndex: '2147483600',
  })
  document.body.appendChild(overlay)

  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = CSS
  document.head.appendChild(style)

  const pathToId = new Map<string, number>()
  const nextId = { v: 1 }
  let selector = DEFAULT_SELECTOR
  let entries: Entry[] = []
  let rafId = 0
  let running = false
  let mutationTimer: number | undefined

  function reposition() {
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i]
      const badge = overlay.children[i] as HTMLElement | undefined
      if (!badge) continue
      const r = e.el.getBoundingClientRect()
      if (r.width === 0 && r.height === 0) {
        badge.style.display = 'none'
        continue
      }
      badge.style.display = ''
      badge.style.transform = `translate(${Math.round(r.left)}px, ${Math.round(
        r.top
      )}px)`
      const off = r.bottom < 0 || r.top > window.innerHeight
      badge.style.opacity = off ? '0.25' : '0.95'
    }
  }

  function rebuild() {
    entries = scan(selector, pathToId, nextId)
    overlay.innerHTML = ''
    for (const e of entries) {
      const b = document.createElement('div')
      b.className = '__dev_cl_badge__'
      b.textContent = 'C' + e.id + (e.name ? ' · ' + e.name : '')
      const descriptor = `C${e.id}${e.name ? ` (${e.name})` : ''} | ${e.path}`
      b.title = descriptor + '\n（点击已复制到剪贴板）'
      b.addEventListener('click', (ev) => {
        ev.stopPropagation()
        void navigator.clipboard?.writeText(descriptor)
        showToast('已复制：' + descriptor)
        // eslint-disable-next-line no-console
        console.log('[组件标注]', descriptor)
      })
      overlay.appendChild(b)
    }
    opts.onCount(entries.length)
    reposition()
  }

  function loop() {
    if (!running) return
    if (opts.getVisible()) reposition()
    rafId = requestAnimationFrame(loop)
  }
  function startLoop() {
    if (rafId) return
    running = true
    loop()
  }
  function stopLoop() {
    running = false
    if (rafId) cancelAnimationFrame(rafId)
    rafId = 0
  }

  const onMutate = () => {
    if (mutationTimer) window.clearTimeout(mutationTimer)
    mutationTimer = window.setTimeout(rebuild, 200)
  }
  const onScrollResize = () => {
    if (opts.getVisible()) reposition()
  }

  const mo = new MutationObserver(onMutate)

  return {
    start() {
      mo.observe(document.documentElement, {
        childList: true,
        subtree: true,
      })
      window.addEventListener('scroll', onScrollResize, true)
      window.addEventListener('resize', onScrollResize)
      rebuild()
      startLoop()
    },
    stop() {
      stopLoop()
      mo.disconnect()
      window.removeEventListener('scroll', onScrollResize, true)
      window.removeEventListener('resize', onScrollResize)
      overlay.remove()
      style.remove()
    },
    setSelector(s: string) {
      selector = s
      rebuild()
    },
    setVisible(v: boolean) {
      overlay.style.display = v ? '' : 'none'
      if (v) reposition()
    },
    getMapping() {
      const m: Record<string, string> = {}
      for (const e of entries) {
        m['C' + e.id + (e.name ? ` (${e.name})` : '')] = e.path
      }
      return m
    },
  }
}

export function mountComponentLabels() {
  const root = document.createElement('div')
  root.id = DEV_ROOT_ID
  document.body.appendChild(root)
  const reactRoot = createRoot(root)
  reactRoot.render(<ComponentLabels />)
}

function ComponentLabels() {
  const [visible, setVisible] = useState(true)
  const [selector, setSelector] = useState(DEFAULT_SELECTOR)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [count, setCount] = useState(0)
  const engineRef = useRef<Engine | null>(null)
  const visibleRef = useRef(visible)
  const selectorRef = useRef(selector)
  visibleRef.current = visible
  selectorRef.current = selector

  useEffect(() => {
    const engine = createEngine({
      getVisible: () => visibleRef.current,
      onCount: setCount,
    })
    engineRef.current = engine
    engine.start()
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && (e.key === 'L' || e.key === 'l')) {
        e.preventDefault()
        setVisible((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      engine.stop()
    }
  }, [])

  useEffect(() => {
    engineRef.current?.setVisible(visible)
  }, [visible])

  const applySelector = () => {
    engineRef.current?.setSelector(selectorRef.current)
  }
  const copyMapping = () => {
    const m = engineRef.current?.getMapping() ?? {}
    const text = JSON.stringify(m, null, 2)
    void navigator.clipboard?.writeText(text)
    showToast('已复制全部组件映射（' + Object.keys(m).length + ' 项）')
  }

  return (
    <>
      <div className="__dev_cl_bar__">
        <button onClick={() => setVisible((v) => !v)}>
          {visible ? '标注：开' : '标注：关'}
        </button>
        <button onClick={() => setSettingsOpen((s) => !s)}>设置</button>
        <span className="cnt">已标注 {count}</span>
      </div>
      {settingsOpen && (
        <div className="__dev_cl_panel__">
          <h4>标注选择器（CSS selector，逗号分隔）</h4>
          <textarea
            value={selector}
            onChange={(e) => setSelector(e.target.value)}
          />
          <div className="row">
            <button onClick={applySelector}>应用</button>
            <button onClick={copyMapping}>复制映射</button>
          </div>
          <p>
            快捷键 Ctrl+Shift+L 开关标注。点击页面上的 C 编号即可复制该组件的定位描述。
            给任意元素加 data-component / data-testid 属性会优先显示其名称作为更友好的标识。
          </p>
        </div>
      )}
    </>
  )
}
