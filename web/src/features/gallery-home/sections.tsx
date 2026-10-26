/**
 * GalleryHome 区块组件（供 Puck 渲染）
 * ------------------------------------------------------------------
 * 前台首页的每个区块抽成独立组件，统一从一个 React Context 读取
 * 「已解析（含多语种覆盖）的首页数据」——这样 Puck 只负责「哪个区块、
 * 什么顺序、显隐」，内容仍来自后台「二开设置 → 首页设置」的语种分桶，
 * 与 Puck 解耦（Puck 自身不带 i18n）。
 *
 * 自定义区块（CustomText / CustomBanner）则直接吃 Puck 的 props，
 * 文案由编辑在 Puck 面板里填（当前为单语种，多语种可作为后续增强）。
 */
import { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { Link as TanstackLink } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import {
  ArrowRight,
  ArrowUp,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  Film,
  Images,
  LayoutGrid,
  Paperclip,
  Play,
  ShieldCheck,
  Sparkles,
  User,
  Video,
} from 'lucide-react'

import {
  HeroShowcaseCard,
  HeroTicker,
  HeroVideoStage,
  ModelTicker,
} from './components'
import type { HomeContent, MotionContent } from './types'

/* ================================================================== */
/* 上下文：已解析的首页数据                                          */
/* ================================================================== */

export type GalleryHomeData = {
  home: HomeContent
  motion: MotionContent
}

const GalleryHomeDataContext = createContext<GalleryHomeData | null>(null)

export function GalleryHomeDataProvider({
  value,
  children,
}: {
  value: GalleryHomeData
  children: React.ReactNode
}) {
  return (
    <GalleryHomeDataContext.Provider value={value}>
      {children}
    </GalleryHomeDataContext.Provider>
  )
}

/** 区块组件读取已解析数据；必须在 <GalleryHomeDataProvider> 内使用 */
export function useGalleryHomeData(): GalleryHomeData {
  const v = useContext(GalleryHomeDataContext)
  if (!v) throw new Error('[gallery-home] section used outside GalleryHomeDataProvider')
  return v
}

/* ================================================================== */
/* 共享小组件                                                        */
/* ================================================================== */

const ICONS: Record<string, typeof LayoutGrid> = {
  LayoutGrid,
  Sparkles,
  Images,
  ShieldCheck,
  BookOpen,
  Film,
  User,
  Video,
}

/** 站内跳转用 TanStack Link（SPA 无刷新）；外链/空值用 <a> */
function Nav({
  to,
  className,
  children,
  ...rest
}: {
  to: string
  className?: string
  children: React.ReactNode
} & Record<string, unknown>) {
  if (!to || /^(https?:)?\/\//.test(to)) {
    return (
      <a href={to || '#'} className={className} {...rest}>
        {children}
      </a>
    )
  }
  return (
    <TanstackLink to={to} className={className} {...rest}>
      {children}
    </TanstackLink>
  )
}

/** Hero 大标题：titleAccent 句子包金色渐变 span；\n 转 <br> */
function renderHeroTitle(title: string, accent?: string) {
  let parts: (string | { accent: string })[] = [title]
  if (accent && title.includes(accent)) {
    const i = title.indexOf(accent)
    parts = [title.slice(0, i), { accent }, title.slice(i + accent.length)]
  }
  return parts.flatMap((p, pi) => {
    const text = typeof p === 'string' ? p : p.accent
    const nodes = text.split('\n').map((line, li) =>
      typeof p === 'string' ? (
        line
      ) : (
        <span key={`${pi}-${li}`} className='home-hero-title-accent'>
          {line}
        </span>
      ),
    )
    const withBreaks: React.ReactNode[] = []
    nodes.forEach((n, ni) => {
      if (ni > 0) withBreaks.push(<br key={`br-${pi}-${ni}`} />)
      withBreaks.push(n)
    })
    return withBreaks
  })
}

/* ================================================================== */
/* 1. Hero 电影感面板                                                 */
/* ================================================================== */

export function HeroSection() {
  const { home: h, motion: m } = useGalleryHomeData()
  const c = h.hero.colors
  const heroVars = {
    ['--hero-screen' as string]: c.screenBg,
    ['--hero-ink' as string]: c.ink,
    ['--hero-muted' as string]: c.muted,
    ['--hero-line' as string]: c.line,
    ['--hero-accent-from' as string]: c.accentFrom,
    ['--hero-accent-via' as string]: c.accentVia,
    ['--hero-accent-to' as string]: c.accentTo,
    ['--hero-scrim-top' as string]: c.scrimTop,
    ['--hero-scrim-mid' as string]: c.scrimMid,
    ['--hero-scrim-bottom' as string]: c.scrimBottom,
    ['--hero-badge-from' as string]: c.badgeFrom,
    ['--hero-badge-to' as string]: c.badgeTo,
    ['--hero-primary-btn' as string]: c.primaryBtn,
    ['--hero-primary-ink' as string]: c.primaryBtnInk,
    ['--hero-mask' as string]: String(m.heroVideo.mask ?? 0.82),
  } as CSSProperties

  return (
    <section className='home-hero' style={heroVars}>
      {m.heroVideo.enabled && (
        <div className='home-hero-stage'>
          <div className='home-hero-stage-inner'>
            <HeroVideoStage videos={m.heroVideo.videos} />
          </div>
        </div>
      )}
      <div className='home-hero-mask' />

      <HeroShowcaseCard card={h.hero.card} />

      <div className='home-hero-inner'>
        <div className='home-hero-copy'>
          <span className='home-hero-announcement rise' style={{ animationDelay: '0ms' }}>
            <b className='home-hero-announcement-badge'>{h.hero.badge}</b>
            <span>{h.hero.announcement}</span>
            <ChevronRight size={13} />
          </span>

          <h1 className='rise' style={{ animationDelay: '80ms' }}>
            {renderHeroTitle(h.hero.title, h.hero.titleAccent)}
          </h1>

          <p className='lead rise' style={{ animationDelay: '160ms' }}>
            {h.hero.subtitle}
          </p>

          <div className='home-hero-actions rise' style={{ animationDelay: '240ms' }}>
            <Nav className='hero-btn-primary' to={h.hero.primaryUrl}>
              <Sparkles size={16} /> {h.hero.primaryLabel}
            </Nav>
            {h.hero.secondaryUrl && (
              <a className='hero-btn-ghost' href={h.hero.secondaryUrl}>
                <span className='hero-btn-play'>
                  <Play size={12} />
                </span>
                {h.hero.secondaryLabel}
                {h.hero.secondaryTime && <em>{h.hero.secondaryTime}</em>}
              </a>
            )}
          </div>

          <div className='home-hero-meta rise' style={{ animationDelay: '320ms' }}>
            {h.hero.metaLabels.map((label) => (
              <span key={label}>
                <i>✓</i>
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div
        className='rise'
        style={{
          animationDelay: '420ms',
          position: 'absolute',
          inset: 'auto 0 0',
          zIndex: 2,
        }}
      >
        <HeroTicker cfg={m.heroTicker} models={m.ticker} />
      </div>
    </section>
  )
}

/* ================================================================== */
/* 2. Canvas Agent                                                    */
/* ================================================================== */

export function AgentSection() {
  const { home: h } = useGalleryHomeData()
  const [agentQ, setAgentQ] = useState('')
  const [agentSkill, setAgentSkill] = useState<string>('auto')
  const [skillMenuOpen, setSkillMenuOpen] = useState(false)
  const skillMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!skillMenuOpen) return
    const onDown = (e: MouseEvent) => {
      if (skillMenuRef.current && !skillMenuRef.current.contains(e.target as Node)) {
        setSkillMenuOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSkillMenuOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [skillMenuOpen])

  const activeSkill =
    agentSkill === 'auto' ? null : (h.agent.skills.find((s) => s.key === agentSkill) ?? null)

  return (
    <section className='section section--tinted' id='home-agent'>
      <div className='container'>
        <div className='agent-head'>
          <div className='agent-head-copy'>
            <span className='eyebrow'>
              <span className='sec-index'>{h.agent.index}</span>
              {h.agent.eyebrow}
            </span>
            <h2>
              {h.agent.titleLine1}
              <br />
              <span className='agent-head-dim'>{h.agent.titleLine2}</span>
            </h2>
          </div>
          <p className='agent-head-lead'>{h.agent.lead}</p>
        </div>

        <div className='agent-composer'>
          <input
            value={agentQ}
            onChange={(e) => setAgentQ(e.target.value)}
            placeholder={h.agent.placeholder}
            aria-label={h.agent.placeholder}
          />
          <div className='agent-composer-bar'>
            <button
              type='button'
              className='agent-attach'
              aria-label={h.agent.attachLabel}
              title={h.agent.attachLabel}
            >
              <Paperclip size={16} />
            </button>
            <div className='agent-skill' ref={skillMenuRef} data-open={skillMenuOpen}>
              <button
                type='button'
                className='agent-auto'
                aria-haspopup='listbox'
                aria-expanded={skillMenuOpen}
                onClick={() => setSkillMenuOpen((v) => !v)}
              >
                {activeSkill ? (
                  <>
                    {(() => {
                      const Icon = ICONS[activeSkill.icon] || Sparkles
                      return <Icon size={14} />
                    })()}
                    {activeSkill.label}
                  </>
                ) : (
                  <>
                    <Sparkles size={14} /> {h.agent.autoLabel}
                  </>
                )}
                <ChevronDown size={13} className='agent-caret' />
              </button>
              {skillMenuOpen && (
                <div className='agent-skill-menu' role='listbox'>
                  <span className='agent-skill-menu-title'>{h.agent.skillsMenuTitle}</span>
                  <button
                    type='button'
                    role='option'
                    aria-selected={agentSkill === 'auto'}
                    className={agentSkill === 'auto' ? 'on' : ''}
                    onClick={() => {
                      setAgentSkill('auto')
                      setSkillMenuOpen(false)
                    }}
                  >
                    <Sparkles size={14} /> {h.agent.autoLabel}
                    {agentSkill === 'auto' && <Check size={14} />}
                  </button>
                  {h.agent.skills.map((s) => {
                    const Icon = ICONS[s.icon] || Sparkles
                    const on = agentSkill === s.key
                    return (
                      <button
                        type='button'
                        key={s.key}
                        role='option'
                        aria-selected={on}
                        className={on ? 'on' : ''}
                        onClick={() => {
                          setAgentSkill(s.key)
                          setSkillMenuOpen(false)
                        }}
                      >
                        <Icon size={14} /> {s.label}
                        {on && <Check size={14} />}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
            <span className='agent-helper'>
              <ShieldCheck size={14} aria-hidden='true' /> {h.agent.helperLabel}
            </span>
            <Nav className='agent-send' to='/prompt-gallery' aria-label={h.agent.sendLabel}>
              <ArrowUp size={18} />
            </Nav>
          </div>
        </div>

        <div className='agent-chips'>
          {h.agent.skills.map((s) => {
            const Icon = ICONS[s.icon] || Sparkles
            const on = agentSkill === s.key
            return (
              <button
                type='button'
                key={s.key}
                className={on ? 'agent-chip on' : 'agent-chip'}
                aria-pressed={on}
                onClick={() => setAgentSkill(on ? 'auto' : s.key)}
              >
                <Icon size={14} /> {s.label}
              </button>
            )
          })}
        </div>

        <div className='agent-body'>
          <ul className='agent-features'>
            {h.agent.features.map((f) => {
              const Icon = ICONS[f.icon] || Sparkles
              return (
                <li key={f.title}>
                  <span className='agent-feature-ico'>
                    <Icon size={18} />
                  </span>
                  <div>
                    <h3>{f.title}</h3>
                    <p>{f.desc}</p>
                  </div>
                </li>
              )
            })}
          </ul>

          <div className='agent-preview'>
            <div className='agent-preview-bubble'>{h.agent.preview.bubble}</div>
            <div className='agent-preview-head'>
              <span className='agent-preview-title'>
                <Sparkles size={14} /> {h.agent.preview.title}
              </span>
              <span className='agent-preview-badge'>{h.agent.preview.badge}</span>
            </div>
            <ul className='agent-preview-plan'>
              {h.agent.preview.plan.map((p) => (
                <li key={p}>
                  <Check size={14} /> {p}
                </li>
              ))}
            </ul>
            <div className='agent-preview-steps'>
              {h.agent.preview.steps.map((s, i) => (
                <button type='button' key={s} className={i === 0 ? 'on' : ''}>
                  <i>{String(i + 1).padStart(2, '0')}</i>
                  {s}
                </button>
              ))}
            </div>
            <div className='agent-preview-actions'>
              <button type='button' className='agent-preview-edit'>
                {h.agent.preview.editLabel}
              </button>
              <Nav className='agent-preview-run' to='/prompt-gallery'>
                {h.agent.preview.runLabel}
              </Nav>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ================================================================== */
/* 3. 三个 Studio                                                     */
/* ================================================================== */

export function StudiosSection() {
  const { home: h } = useGalleryHomeData()
  return (
    <section className='section'>
      <div className='container'>
        <div className='section-head'>
          <span className='eyebrow'>
            <span className='sec-index'>{h.studios.index}</span>
            {h.studios.eyebrow}
          </span>
          <h2>{h.studios.title}</h2>
          <p>{h.studios.lead}</p>
        </div>
        <div className='studios'>
          {h.studios.items.map((s) => (
            <Nav className='studio' to={s.url} key={s.title}>
              <div className='studio-media'>
                <img src={s.image} alt={s.title} loading='lazy' />
              </div>
              <div className='studio-body'>
                <span className='studio-kicker'>{s.kicker}</span>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
                <span className='studio-cta'>
                  {s.cta} <ArrowRight size={14} />
                </span>
              </div>
            </Nav>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ================================================================== */
/* 4. 灵感画廊                                                        */
/* ================================================================== */

export function GallerySection() {
  const { t } = useTranslation()
  const { home: h } = useGalleryHomeData()
  return (
    <section className='section section--tinted'>
      <div className='container'>
        <div className='gallery-head'>
          <div>
            <span className='eyebrow'>
              <span className='sec-index'>{h.gallery.index}</span>
              {h.gallery.eyebrow}
            </span>
            <h2
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: 'clamp(26px,3.4vw,38px)',
                margin: '10px 0 0',
                fontWeight: 600,
              }}
            >
              {h.gallery.title}
            </h2>
          </div>
          <div className='gallery-tabs' role='group'>
            {h.gallery.tabs.map((tab, i) => (
              <button key={tab} type='button' aria-pressed={i === 0}>
                {tab}
              </button>
            ))}
          </div>
        </div>
        <p style={{ color: 'var(--muted)', marginTop: 14 }}>{h.gallery.lead}</p>

        <div className='gallery-grid'>
          {h.gallery.items.map((g) => (
            <Nav className='gcard' to={g.url} key={g.title}>
              <div className='gcard-cover'>
                {g.cover ? (
                  <img src={g.cover} alt={g.title} loading='lazy' />
                ) : (
                  <span className='ph'>YMM</span>
                )}
              </div>
              <div className='gcard-body'>
                <div className='gcard-title'>{g.title}</div>
                <div className='gcard-meta'>
                  <span className='gcard-model'>{g.model}</span>
                  <span className='gcard-view'>
                    {t('View prompt')} <ChevronRight size={12} />
                  </span>
                </div>
              </div>
            </Nav>
          ))}
        </div>

        <div className='center'>
          <Nav className='gallery-link' to='/prompt-gallery'>
            {h.gallery.exploreLabel} <ArrowRight size={14} />
          </Nav>
        </div>

        {h.gallery.featuredVideo && (
          <div className='featured-video'>
            <video
              src={h.gallery.featuredVideo}
              autoPlay
              muted
              loop
              playsInline
              preload='metadata'
            />
            <span className='cap'>{h.gallery.featuredTitle}</span>
          </div>
        )}
      </div>
    </section>
  )
}

/* ================================================================== */
/* 5. 模型亮点                                                       */
/* ================================================================== */

export function ModelsSection() {
  const { t } = useTranslation()
  const { home: h } = useGalleryHomeData()
  return (
    <section className='section'>
      <div className='container'>
        <div className='section-head'>
          <span className='eyebrow'>
            <span className='sec-index'>{h.models.index}</span>
            {h.models.eyebrow}
          </span>
          <h2>{h.models.title}</h2>
          <p>{h.models.lead}</p>
        </div>
        <div className='model-stats'>
          <div className='stat'>
            <b>{h.models.stats.models}</b>
            <span>{t('Available models')}</span>
          </div>
          <div className='stat'>
            <b>{h.models.stats.providers}</b>
            <span>{t('Providers')}</span>
          </div>
        </div>
        <div className='model-list'>
          {h.models.items.map((mi) => (
            <Nav className='model-item' to={mi.url} key={mi.name}>
              <span className='model-rank'>{String(mi.rank).padStart(2, '0')}</span>
              <span className='model-thumb'>
                <img src={mi.thumb} alt={mi.name} loading='lazy' />
              </span>
              <span className='model-info'>
                <b>{mi.name}</b>
                <span>{mi.type}</span>
              </span>
            </Nav>
          ))}
        </div>
        <div className='center'>
          <Nav className='gallery-link' to='/pricing'>
            {h.models.exploreLabel} <ArrowRight size={14} />
          </Nav>
        </div>
      </div>
    </section>
  )
}

/* ================================================================== */
/* 6. 统一 API CTA                                                    */
/* ================================================================== */

export function CtaSection() {
  const { home: h } = useGalleryHomeData()
  return (
    <section className='section cta'>
      <div className='container'>
        <div className='cta-inner'>
          <span className='eyebrow' style={{ color: 'var(--hero-gold)' }}>
            <span className='sec-index'>{h.cta.index}</span>
            YMM · You Make Moments
          </span>
          <h2>{h.cta.title}</h2>
          <p>{h.cta.lead}</p>
          <ul className='cta-features'>
            {h.cta.features.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
          <div className='code-card'>
            <div
              style={{
                color: 'var(--muted)',
                fontSize: 12,
                marginBottom: 8,
                fontFamily: 'var(--font-sans)',
              }}
            >
              {h.cta.codeTitle}
            </div>
            <pre style={{ margin: 0 }}>{h.cta.code}</pre>
          </div>
          <div
            className='cta-row'
            style={{
              display: 'flex',
              gap: 12,
              justifyContent: 'center',
              marginTop: 22,
              flexWrap: 'wrap',
            }}
          >
            <Nav className='gen-btn' to={h.cta.connectUrl}>
              <Play size={16} /> {h.cta.genLabel}
            </Nav>
            <Nav
              className='btn-ghost'
              to='/pricing'
              style={{ borderColor: 'var(--hero-line)', color: 'var(--hero-ink)' }}
            >
              {h.cta.connectLabel} <ChevronRight size={14} />
            </Nav>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ================================================================== */
/* 7. 落幕 CTA                                                        */
/* ================================================================== */

export function ClosingSection() {
  const { home: h } = useGalleryHomeData()
  return (
    <section className='home-closing' aria-labelledby='home-closing-title'>
      <div className='home-closing-panel'>
        <img
          className='home-closing-art'
          src={h.closing.art}
          alt=''
          loading='lazy'
          decoding='async'
        />
        <div className='home-closing-inner'>
          <p className='home-closing-kicker'>
            <Sparkles size={16} /> {h.closing.kicker}
          </p>
          <h2 id='home-closing-title' className='home-closing-title'>
            {h.closing.title}
          </h2>
          <p className='home-closing-lede'>{h.closing.lead}</p>
          <div className='home-closing-actions'>
            <Nav className='hero-btn-primary' to={h.closing.primaryUrl}>
              {h.closing.primaryLabel}
            </Nav>
            <Nav className='hero-btn-ghost' to={h.closing.secondaryUrl}>
              {h.closing.secondaryLabel}
            </Nav>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ================================================================== */
/* 8. 页脚上方模型滚动条                                             */
/* ================================================================== */

export function ModelTickerSection() {
  const { motion: m } = useGalleryHomeData()
  return <ModelTicker models={m.ticker} tickerSec={m.tickerSec} />
}

/* ================================================================== */
/* 自定义区块：在 Puck 面板里填写（当前单语种）                       */
/* ================================================================== */

export type CustomTextProps = {
  kicker?: string
  title?: string
  body?: string
  url?: string
  urlLabel?: string
}

export function CustomTextSection({
  kicker,
  title,
  body,
  url,
  urlLabel,
}: CustomTextProps) {
  return (
    <section className='section'>
      <div className='container'>
        <div className='section-head'>
          {kicker && <span className='eyebrow'>{kicker}</span>}
          {title && <h2>{title}</h2>}
          {body && <p>{body}</p>}
        </div>
        {url && (
          <div className='center'>
            <a className='gallery-link' href={url}>
              {urlLabel || url} <ArrowRight size={14} />
            </a>
          </div>
        )}
      </div>
    </section>
  )
}

export type CustomBannerProps = {
  title?: string
  body?: string
  url?: string
  bg?: string
}

export function CustomBannerSection({ title, body, url, bg }: CustomBannerProps) {
  return (
    <section className='section section--tinted'>
      <div
        className='container'
        style={
          bg
            ? {
                background: bg,
                borderRadius: 16,
                padding: '28px 24px',
              }
            : undefined
        }
      >
        {title && <h2 style={{ margin: 0 }}>{title}</h2>}
        {body && <p style={{ marginTop: 10 }}>{body}</p>}
        {url && (
          <div className='center'>
            <a className='gallery-link' href={url}>
              {url} <ArrowRight size={14} />
            </a>
          </div>
        )}
      </div>
    </section>
  )
}
