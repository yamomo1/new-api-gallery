/**
 * StudioScene —— 「画布工作室」场景（两处共用同一份实现）
 * ------------------------------------------------------------------
 *   1) /canvas 落地页        <StudioScene as='h1' ... />
 *   2) 首页第 3 屏（02 区块） <StudioScene as='h2' embed ... />
 *
 * 结构（对标 api.seedance.nz 画布工作室页）：
 *   · 头部：编号眉标 + 两行大标题（左） / 说明段（右）
 *   · 左侧：无边画布面板（抽象 3D 主图 + 虚线选区 + 工具条 + 「画布」浮标）
 *   · 右侧：两张工作室卡（文生图 / 图生视频）：标签 + 图 + 提示词胶囊
 *           + 图标标题 + 描述 + 进入链接
 *
 * 动效（样式见 canvas-landing.css）：
 *   · 眉标 / 两行标题 / 说明段依次淡入上浮（ctlp-line-in）
 *   · 画布：主图缓慢推拉（kenburns）、选区虚线行军蚁、四角手柄呼吸、
 *           辅助线描出、工具按钮依次弹出、底部浮标轻浮
 *   · 提示词：打字机逐字出现 → 停留 → 逐字回删 → 循环（金色光标闪烁）
 *   · 卡片：滚动进入视口交错出现（data-reveal-group）、hover 上浮 + 图片缓推
 *
 * embed 模式额外做两件事：
 *   · .ctlp-embed 去掉页面级留白/背景/辉光，直接嵌进首页区块
 *   · 所有「入场类」动画先把 play-state 冻结（paused），等区块滚进视口挂上
 *     .is-live 才开跑 —— 否则用户在页面顶部时动画就已经播完了
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link as TanstackLink } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import {
  ArrowUp,
  ArrowUpRight,
  Film,
  Image as ImageIcon,
  Loader2,
  Move,
  Paperclip,
  Type,
} from 'lucide-react'

import './canvas-landing.css'

type HeadingTag = 'h1' | 'h2'

/** 内置素材：与首页/对标站同一批图，调用方可覆盖 */
const DEFAULT_MEDIA = {
  canvas: '/images/home/creative-canvas-artwork.webp',
  image: '/images/home/studio-portrait-v3.webp',
  motion: '/images/home/model-cinema-v3.webp',
}

export type StudioSceneProps = {
  /** 编号，如 '01'（落地页）/ '02'（首页第 3 屏） */
  index: string
  /** 眉标文字（已翻译），如「画布工作室」 */
  eyebrow: string
  /** 两行大标题（已翻译），如 ['一个想法。', '各种创造方式。'] */
  titleLines: [string, string]
  /** 右侧说明段（已翻译） */
  lead: string
  /** 标题标签：落地页用 h1，页面内嵌用 h2（同页避免多个 h1） */
  as?: HeadingTag
  /** 嵌进首页区块：去页面留白、入场动画改为滚动到才播 */
  embed?: boolean
  /** 三张图（画布主图 / 图片工作室 / 动效工作室） */
  media?: Partial<typeof DEFAULT_MEDIA>
  /** 两张卡的跳转地址 */
  links?: { image: string; motion: string }
  /** 左画布面板下方正文：标题 + 描述 + 进入链接（来自首页 data.ts studios.items[0]） */
  canvasBody?: { title: string; desc: string; cta: string; to: string }
}

/** 系统「减少动效」偏好（打字机 / 推拉镜头等持续动画在此关掉） */
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setReduced(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])
  return reduced
}

/**
 * 第一次进入视口把 seen 置 true（之后不再变），
 * embed 模式用它决定「入场动画什么时候开跑」。
 */
function useInViewOnce<T extends HTMLElement>() {
  const ref = useRef<T | null>(null)
  const [seen, setSeen] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el || seen) return
    if (typeof IntersectionObserver === 'undefined') {
      setSeen(true)
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true)
          io.disconnect()
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -10% 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [seen])

  return [ref, seen] as const
}

/**
 * 打字机：逐字打出 → 停留 → 逐字回删 → 切下一条，循环。
 * startDelay 让多张卡错开起播；enabled=false 时保持空串（等区块进视口再开）。
 */
function useTypewriter(
  lines: string[],
  startDelay = 0,
  enabled = true,
): string {
  const reduced = usePrefersReducedMotion()
  const [idx, setIdx] = useState(0)
  const [text, setText] = useState('')
  const [phase, setPhase] = useState<'wait' | 'type' | 'hold' | 'erase'>('wait')

  useEffect(() => {
    if (reduced) {
      setText(lines[0] ?? '')
      return
    }
    if (!enabled) return
    const full = lines[idx % lines.length] ?? ''
    let timer = 0
    if (phase === 'wait') {
      timer = window.setTimeout(() => setPhase('type'), startDelay)
    } else if (phase === 'type') {
      if (text.length < full.length) {
        timer = window.setTimeout(
          () => setText(full.slice(0, text.length + 1)),
          52,
        )
      } else {
        timer = window.setTimeout(() => setPhase('hold'), 0)
      }
    } else if (phase === 'hold') {
      timer = window.setTimeout(() => setPhase('erase'), 1900)
    } else if (text.length > 0) {
      timer = window.setTimeout(
        () => setText(full.slice(0, text.length - 1)),
        24,
      )
    } else {
      timer = window.setTimeout(() => {
        setIdx((i) => i + 1)
        setPhase('type')
      }, 260)
    }
    return () => window.clearTimeout(timer)
  }, [phase, text, idx, lines, startDelay, reduced, enabled])

  return text
}

type StudioCard = {
  tagKey: string
  image: string
  promptKeys: string[]
  icon: typeof ImageIcon
  titleKey: string
  descKey: string
  linkKey: string
  to: string
  /** 图上浮层的形态：prompt = 打字机提示词胶囊；progress = 生成进度条 */
  mode: 'prompt' | 'progress'
  /** 打字机起播延迟：两张卡错开，避免同时开始 */
  delay: number
}

/** 生成进度：0→100 用 duration 毫秒，满格停 hold 毫秒后重来（模拟连续出片） */
function useProgress(active: boolean, duration = 6400, hold = 800): number {
  const reduced = usePrefersReducedMotion()
  const [pct, setPct] = useState(reduced ? 100 : 0)

  useEffect(() => {
    if (reduced) {
      setPct(100)
      return
    }
    if (!active) return
    let raf = 0
    let start = performance.now()
    let last = -1
    const step = (now: number) => {
      const elapsed = now - start
      if (elapsed >= duration + hold) {
        start = now
        last = 0
        setPct(0)
      } else {
        const v = Math.min(100, Math.round((elapsed / duration) * 100))
        if (v !== last) {
          last = v
          setPct(v)
        }
      }
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [active, duration, hold, reduced])

  return pct
}

export function StudioScene({
  index,
  eyebrow,
  titleLines,
  lead,
  as: Heading = 'h2',
  embed = false,
  media,
  links,
  canvasBody,
}: StudioSceneProps) {
  const [ref, seen] = useInViewOnce<HTMLDivElement>()
  // 落地页永远算「已进视口」；embed 模式等滚动到再开跑
  const live = embed ? seen : true
  // 逐项兜底：调用方可能只覆盖其中一张图（传 undefined 时不能把默认图冲掉）
  const img = {
    canvas: media?.canvas || DEFAULT_MEDIA.canvas,
    image: media?.image || DEFAULT_MEDIA.image,
    motion: media?.motion || DEFAULT_MEDIA.motion,
  }

  const cards: StudioCard[] = useMemo(
    () => [
      {
        tagKey: 'Text to image',
        image: img.image,
        promptKeys: [
          'Silver foil hood, warm rim light, studio portrait',
          'A lone figure before an eclipse over still water, cinematic',
        ],
        icon: ImageIcon,
        titleKey: 'Image studio',
        descKey:
          'From a single prompt to polished images, with leading image models at hand.',
        linkKey: 'Open image studio',
        to: links?.image ?? '/prompt-gallery',
        mode: 'prompt',
        delay: 0,
      },
      {
        tagKey: 'Image to video',
        image: img.motion,
        promptKeys: [
          'A lone figure before an eclipse over still water, cinematic',
          'Silver foil hood, warm rim light, studio portrait',
        ],
        icon: Film,
        titleKey: 'Motion studio',
        descKey: 'Turn a still frame into motion, and direct every second.',
        linkKey: 'Open motion studio',
        to: links?.motion ?? '/prompt-gallery',
        mode: 'progress',
        delay: 950,
      },
    ],
    [img.image, img.motion, links?.image, links?.motion],
  )

  return (
    <div
      ref={ref}
      className={`ctlp${embed ? ' ctlp-embed' : ''}${live ? ' is-live' : ''}`}
    >
      <div className={embed ? 'ctlp-inner' : 'ctlp-shell'}>
        {/* 头部：编号眉标 + 两行大标题（左）／说明段（右） */}
        <div className='ctlp-head'>
          <div className='ctlp-head-copy'>
            <span className='ctlp-eyebrow'>
              <i>{index}</i>
              <span className='ctlp-sep' aria-hidden='true' />
              {eyebrow}
            </span>
            <Heading className='ctlp-title'>
              <span style={{ animationDelay: '90ms' }}>{titleLines[0]}</span>
              <span style={{ animationDelay: '190ms' }}>
                {titleLines[1]}
              </span>
            </Heading>
          </div>
          <p className='ctlp-lead'>{lead}</p>
        </div>

        <div className='ctlp-grid'>
          <CanvasPanel image={img.canvas} body={canvasBody} />

          <div className='ctlp-stack' data-reveal-group data-reveal-step='140'>
            {cards.map((card) => (
              <StudioCardView key={card.tagKey} card={card} enabled={live} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/** 左侧：无边画布面板（主图 + 虚线选区 + 工具条 + 画布浮标）+ 下方正文 */
function CanvasPanel({
  image,
  body,
}: {
  image: string
  body?: { title: string; desc: string; cta: string; to: string }
}) {
  const { t } = useTranslation()
  return (
    <div className='ctlp-canvas' data-reveal>
      <div className='ctlp-canvas-frame'>
        <img
          className='ctlp-canvas-art'
          src={image}
          alt=''
          loading='eager'
          decoding='async'
        />

        {/* 辅助线：从选区向画布边缘延伸 */}
        <span className='ctlp-guide ctlp-guide-v' aria-hidden='true' />
        <span className='ctlp-guide ctlp-guide-h' aria-hidden='true' />

        {/* 虚线选区 + 四角手柄（行军蚁 + 呼吸） */}
        <div className='ctlp-sel' aria-hidden='true'>
          <span className='ctlp-sel-edge ctlp-sel-t' />
          <span className='ctlp-sel-edge ctlp-sel-r' />
          <span className='ctlp-sel-edge ctlp-sel-b' />
          <span className='ctlp-sel-edge ctlp-sel-l' />
          <span className='ctlp-sel-handle ctlp-h-tl' />
          <span className='ctlp-sel-handle ctlp-h-tr' />
          <span className='ctlp-sel-handle ctlp-h-bl' />
          <span className='ctlp-sel-handle ctlp-h-br' />
        </div>

        {/* 左侧竖向工具条 */}
        <div className='ctlp-tools'>
          <button type='button' aria-label={t('Move')}>
            <Move size={14} />
          </button>
          <button type='button' aria-label={t('Type')}>
            <Type size={14} />
          </button>
          <button type='button' aria-label={t('Image')}>
            <ImageIcon size={14} />
          </button>
        </div>

        {/* 左下「画布」浮标 */}
        <span className='ctlp-canvas-badge'>
          <ImageIcon size={13} />
          {t('Canvas')}
        </span>
      </div>

      {/* 画布下方正文：对标站左大图下方那段标题 + 描述 + 进入链接 */}
      {body && (
        <div className='ctlp-canvas-body'>
          <h3>
            <ImageIcon size={14} />
            {body.title}
          </h3>
          <p>{body.desc}</p>
          <TanstackLink className='ctlp-card-link' to={body.to}>
            {body.cta}
            <ArrowUpRight size={13} />
          </TanstackLink>
        </div>
      )}
    </div>
  )
}

/** 右侧：单个工作室卡 */
function StudioCardView({
  card,
  enabled,
}: {
  card: StudioCard
  enabled: boolean
}) {
  const { t } = useTranslation()
  const lines = useMemo(
    () => card.promptKeys.map((k) => t(k)),
    [card.promptKeys, t],
  )
  const typed = useTypewriter(
    lines,
    card.delay,
    enabled && card.mode === 'prompt',
  )
  const Icon = card.icon

  return (
    <article className='ctlp-card'>
      <span className='ctlp-card-tag'>{t(card.tagKey)}</span>

      <div className='ctlp-card-media'>
        <img src={card.image} alt='' loading='lazy' decoding='async' />

        {card.mode === 'progress' ? (
          <ProgressPill active={enabled} />
        ) : (
          /* 提示词输入胶囊：图标 + 打字机文案 + 圆形生成按钮 */
          <div className='ctlp-prompt'>
            <Paperclip size={13} className='ctlp-clip' />
            <span className='ctlp-prompt-text'>
              {typed}
              <i className='ctlp-caret' aria-hidden='true' />
            </span>
            <button
              type='button'
              className='ctlp-submit'
              aria-label={t('Generate')}
            >
              <ArrowUp size={14} />
            </button>
          </div>
        )}
      </div>

      <div className='ctlp-card-body'>
        <h3>
          <Icon size={14} />
          {t(card.titleKey)}
        </h3>
        <p>{t(card.descKey)}</p>
        <TanstackLink className='ctlp-card-link' to={card.to}>
          {t(card.linkKey)}
          <ArrowUpRight size={13} />
        </TanstackLink>
      </div>
    </article>
  )
}

/** 图上浮层：生成进度条（图生视频卡用，替代打字机提示词） */
function ProgressPill({ active }: { active: boolean }) {
  const { t } = useTranslation()
  const pct = useProgress(active)

  return (
    <div
      className='ctlp-prompt ctlp-prompt--progress'
      role='progressbar'
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      aria-label={t('Generating')}
    >
      <Loader2 size={13} className='ctlp-spin' aria-hidden='true' />
      <span className='ctlp-progress-label'>{t('Generating')}</span>
      <span className='ctlp-progress-track' aria-hidden='true'>
        <i className='ctlp-progress-fill' style={{ width: `${pct}%` }} />
      </span>
      <span className='ctlp-progress-pct'>{pct}%</span>
    </div>
  )
}
