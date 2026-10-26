/**
 * CanvasLanding —— 「画布工作室」落地页
 * ------------------------------------------------------------------
 * 对标 api.seedance.nz/canvas（00 · 画布工作室）第三页，1:1 复刻：
 *   · 头部：编号眉标 + 两行大标题（左） / 说明段（右）
 *   · 左侧：无边画布面板（抽象 3D 主图 + 虚线选区 + 控制工具条 + 「画布」浮标）
 *   · 右侧：两张工作室卡（文生图 / 图生视频）：标签 + 图 + 提示词输入胶囊
 *           + 图标标题 + 描述 + 进入链接
 *
 * 动效：
 *   · 首屏：眉标 / 两行标题 / 说明段依次淡入上浮（ctlp-line-in）
 *   · 画布：主图缓慢推拉（kenburns）、选区虚线行军蚁（marching ants）、
 *           四角手柄呼吸、辅助线描出、工具按钮依次弹出、底部浮标轻浮
 *   · 提示词：打字机逐字出现 → 停留 → 逐字回删 → 换下一条（带金色光标闪烁）
 *   · 卡片：滚动进入视口交错出现（data-reveal-group）、hover 上浮 + 图片缓推 + 金色描边
 *
 * 样式：canvas-landing.css（作用域 .ctlp，深色电影感单主题）
 */
import { useEffect, useMemo, useState } from 'react'
import { Link as TanstackLink } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import {
  ArrowUp,
  ArrowUpRight,
  Film,
  Image as ImageIcon,
  Move,
  Paperclip,
  Type,
} from 'lucide-react'

import { PublicLayout } from '@/components/layout'
import { useScrollReveal } from '@/hooks/use-scroll-reveal'

import './canvas-landing.css'

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
 * 打字机：逐字打出 → 停留 → 逐字回删 → 切下一条，循环。
 * startDelay 让多张卡片错开起播，避免同时打字。
 */
function useTypewriter(lines: string[], startDelay = 0): string {
  const reduced = usePrefersReducedMotion()
  const [idx, setIdx] = useState(0)
  const [text, setText] = useState('')
  const [phase, setPhase] = useState<'wait' | 'type' | 'hold' | 'erase'>('wait')

  useEffect(() => {
    if (reduced) {
      setText(lines[0] ?? '')
      return
    }
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
  }, [phase, text, idx, lines, startDelay, reduced])

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
  /** 打字机起播延迟：两张卡错开，避免同时开始 */
  delay: number
}

/** 右侧两张工作室卡（文案走 i18n key，图片用站内已有素材） */
const STUDIO_CARDS: StudioCard[] = [
  {
    tagKey: 'Text to image',
    image: '/images/home/studio-portrait-v3.webp',
    promptKeys: [
      'Silver foil hood, warm rim light, studio portrait',
      'A lone figure before an eclipse over still water, cinematic',
    ],
    icon: ImageIcon,
    titleKey: 'Image studio',
    descKey:
      'From a single prompt to polished images, with leading image models at hand.',
    linkKey: 'Open image studio',
    to: '/prompt-gallery',
    delay: 0,
  },
  {
    tagKey: 'Image to video',
    image: '/images/home/model-cinema-v3.webp',
    promptKeys: [
      'A lone figure before an eclipse over still water, cinematic',
      'Silver foil hood, warm rim light, studio portrait',
    ],
    icon: Film,
    titleKey: 'Motion studio',
    descKey: 'Turn a still frame into motion, and direct every second.',
    linkKey: 'Open motion studio',
    to: '/prompt-gallery',
    delay: 950,
  },
]

export function CanvasLanding() {
  const { t } = useTranslation()
  useScrollReveal('.ctlp')

  return (
    <PublicLayout showMainContainer={false}>
      <div className='ctlp'>
        <section className='ctlp-hero'>
          <div className='ctlp-shell'>
            {/* 头部：编号眉标 + 两行大标题（左）／说明段（右） */}
            <div className='ctlp-head'>
              <div className='ctlp-head-copy'>
                <span className='ctlp-eyebrow'>
                  <i>01</i>
                  <span className='ctlp-sep' aria-hidden='true' />
                  {t('Canvas studio')}
                </span>
                <h1>
                  <span style={{ animationDelay: '90ms' }}>{t('One idea.')}</span>
                  <span style={{ animationDelay: '190ms' }}>
                    {t('Every way to create.')}
                  </span>
                </h1>
              </div>
              <p className='ctlp-lead'>
                {t(
                  'A visual workspace for exploration, focused studios for speed, and stable model access when your idea becomes a product.',
                )}
              </p>
            </div>

            <div className='ctlp-grid'>
              <CanvasPanel />

              <div
                className='ctlp-stack'
                data-reveal-group
                data-reveal-step='140'
              >
                {STUDIO_CARDS.map((card) => (
                  <StudioCardView key={card.tagKey} card={card} />
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </PublicLayout>
  )
}

/** 左侧：无边画布面板（主图 + 虚线选区 + 工具条 + 画布浮标） */
function CanvasPanel() {
  const { t } = useTranslation()
  return (
    <div className='ctlp-canvas' data-reveal>
      <img
        className='ctlp-canvas-art'
        src='/images/home/creative-workspace-hero.webp'
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
  )
}

/** 右侧：单个工作室卡 */
function StudioCardView({ card }: { card: StudioCard }) {
  const { t } = useTranslation()
  const lines = useMemo(() => card.promptKeys.map((k) => t(k)), [card.promptKeys, t])
  const typed = useTypewriter(lines, card.delay)
  const Icon = card.icon

  return (
    <article className='ctlp-card'>
      <span className='ctlp-card-tag'>{t(card.tagKey)}</span>

      <div className='ctlp-card-media'>
        <img src={card.image} alt='' loading='lazy' decoding='async' />

        {/* 提示词输入胶囊：图标 + 打字机文案 + 圆形生成按钮 */}
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
