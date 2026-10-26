/**
 * GalleryHome —— 电影感画廊首页（移植自 gallery-frontend，适配 New API）
 * ------------------------------------------------------------------
 * 区块流（与对标站一致）：
 *   1. Hero 电影感面板：视频背景 + 蒙版 + 左文字 + 右上浮动四像卡 + 底部模型条
 *   2. Canvas Agent：标题 + 输入框 + 4 特性卡
 *   3. 三个 Studio：Canvas / 文生图 / 文生视频
 *   4. 灵感画廊：筛选 tabs + 作品网格 + 精选视频
 *   5. 模型亮点：295 模型 / 30 供应商 + 10 个模型列表
 *   6. 统一 API CTA：特性 + curl 代码示例
 *   7. 页脚上方模型滚动条（ModelTicker）
 *
 * 动效：home-settle 2.4s 落定 / home-rise 0.7s stagger 上浮 / home-bob 浮卡轻浮
 * 样式：gallery-home.css（作用域 .ghome，颜色继承 New API 主题变量 → 换肤联动）
 */
import type { CSSProperties } from 'react'
import { useState } from 'react'
import { Link as TanstackLink } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import {
  ArrowRight,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronRight,
  Images,
  LayoutGrid,
  Paperclip,
  Play,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'

import { PublicLayout } from '@/components/layout'

import {
  HeroShowcaseCard,
  HeroTicker,
  HeroVideoStage,
  ModelTicker,
} from './components'
import { HOME_DATA, MOTION_DATA } from './data'
import './gallery-home.css'

const ICONS: Record<string, typeof LayoutGrid> = {
  LayoutGrid,
  Sparkles,
  Images,
  ShieldCheck,
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

export function GalleryHome() {
  const { t } = useTranslation()
  const h = HOME_DATA
  const m = MOTION_DATA
  const [agentQ, setAgentQ] = useState('')

  // Hero 配色 → CSS 变量（后台改数据即改色）
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
    <PublicLayout showMainContainer={false}>
      <div className='ghome'>
        {/* ============ 1. Hero 电影感面板 ============ */}
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
              <span
                className='home-hero-announcement rise'
                style={{ animationDelay: '0ms' }}
              >
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

              <div
                className='home-hero-actions rise'
                style={{ animationDelay: '240ms' }}
              >
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

              <div
                className='home-hero-meta rise'
                style={{ animationDelay: '320ms' }}
              >
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
            <HeroTicker />
          </div>
        </section>

        {/* ============ 2. Canvas Agent ============ */}
        <section className='section section--tinted' id='home-agent'>
          <div className='container'>
            <div className='section-head'>
              <span className='eyebrow'>
                <span className='sec-index'>{h.agent.index}</span>
                {h.agent.eyebrow}
              </span>
              <h2>{h.agent.title}</h2>
              <p>{h.agent.lead}</p>
            </div>
            {/* 大输入面板：参考图 + 自动模式 + helper + 圆形发送（对标站同款） */}
            <div className='agent-composer'>
              <input
                value={agentQ}
                onChange={(e) => setAgentQ(e.target.value)}
                placeholder={h.agent.placeholder}
                aria-label={h.agent.placeholder}
              />
              <div className='agent-composer-bar'>
                <button type='button' className='agent-attach' aria-label={h.agent.attachLabel}>
                  <Paperclip size={15} /> {h.agent.attachLabel}
                </button>
                <button type='button' className='agent-auto'>
                  <Sparkles size={14} /> {h.agent.autoLabel} <ChevronDown size={13} />
                </button>
                <span className='agent-helper'>
                  <i aria-hidden='true' /> {h.agent.helperLabel}
                </span>
                <Nav className='agent-send' to='/prompt-gallery' aria-label={h.agent.sendLabel}>
                  <ArrowUp size={18} />
                </Nav>
              </div>
            </div>

            {/* 快捷意图 chips */}
            <div className='agent-chips'>
              {h.agent.chips.map((c) => (
                <button type='button' key={c} className='agent-chip'>
                  {c}
                </button>
              ))}
            </div>

            {/* 两栏：左特性列表 + 右「画布 Agent」预览卡（对标站同款） */}
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
                <div className='agent-preview-bubble'>
                  {h.agent.preview.bubble}
                </div>
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

        {/* ============ 3. 三个 Studio ============ */}
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

        {/* ============ 4. 灵感画廊 ============ */}
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
            <p style={{ color: 'var(--muted)', marginTop: 14 }}>
              {h.gallery.lead}
            </p>

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

        {/* ============ 5. 模型亮点 ============ */}
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
                  <span className='model-rank'>
                    {String(mi.rank).padStart(2, '0')}
                  </span>
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

        {/* ============ 6. 统一 API CTA ============ */}
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
                  style={{
                    borderColor: 'var(--hero-line)',
                    color: 'var(--hero-ink)',
                  }}
                >
                  {h.cta.connectLabel} <ChevronRight size={14} />
                </Nav>
              </div>
            </div>
          </div>
        </section>

        {/* ============ 7. 落幕 CTA（对标 .home-closing：地平线背景 + 双按钮收尾） ============ */}
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

        {/* ============ 8. 页脚上方模型滚动条 ============ */}
        <ModelTicker />
      </div>
    </PublicLayout>
  )
}

export default GalleryHome
