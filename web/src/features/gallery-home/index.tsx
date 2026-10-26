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
import { useEffect, useRef, useState } from 'react'
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

import { PublicLayout } from '@/components/layout'

import {
  HeroShowcaseCard,
  HeroTicker,
  HeroVideoStage,
  ModelTicker,
} from './components'
import { useGalleryHomeContent } from './api'
import './gallery-home.css'

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

/** 技能选中态 key：'auto' = 自动（推荐），其余为 skills[].key */
type AgentSkillKey = string

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

/**
 * Hero 大标题：\n 转 <br>；金色强调句（titleAccent）两种情形：
 * 1) 强调句是标题的子串 → 原地包金色 span；
 * 2) 强调句独立成行（后台是单独一个字段）→ 追加为标题之后的独立金色行。
 */
function renderHeroTitle(title: string, accent?: string) {
  const accentStr = accent?.trim()
  const embedded = !!accentStr && title.includes(accentStr)
  let parts: (string | { accent: string; leading: boolean })[] = [title]
  if (embedded) {
    // 情形 1：强调句内嵌在标题里，原地高亮（不换行）
    const i = title.indexOf(accentStr!)
    parts = [
      title.slice(0, i),
      { accent: accentStr!, leading: false },
      title.slice(i + accentStr!.length),
    ]
  } else if (accentStr) {
    // 情形 2：强调句是独立字段，作为标题之后的金色行（前补换行）
    parts = [title, { accent: accentStr, leading: true }]
  }
  return parts.flatMap((p, pi) => {
    const isAccent = typeof p !== 'string'
    const text = isAccent ? p.accent : p
    const nodes = text.split('\n').map((line, li) =>
      isAccent ? (
        <span key={`${pi}-${li}`} className='home-hero-title-accent'>
          {line}
        </span>
      ) : (
        line
      ),
    )
    const withBreaks: React.ReactNode[] = []
    // 独立金色行之前补一个换行，与上一行（标题末行）分行显示
    if (isAccent && p.leading) withBreaks.push(<br key={`br-accent-lead-${pi}`} />)
    nodes.forEach((n, ni) => {
      if (ni > 0) withBreaks.push(<br key={`br-${pi}-${ni}`} />)
      withBreaks.push(n)
    })
    return withBreaks
  })
}

export function GalleryHome() {
  const { t } = useTranslation()

  // 首页数据：内置默认（按当前语言）深合并后台「二开设置 → 首页设置」(GET /api/home_config)
  // 由 api.ts 的 TanStack Query 钩子统一提供（缓存 + 重试 + 解析校验）
  const { home: h, motion: m } = useGalleryHomeContent()
  const [agentQ, setAgentQ] = useState('')
  const [agentSkill, setAgentSkill] = useState<AgentSkillKey>('auto')
  const [skillMenuOpen, setSkillMenuOpen] = useState(false)
  const skillMenuRef = useRef<HTMLDivElement>(null)

  // 下拉菜单：点击外部 / Esc 关闭
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
    agentSkill === 'auto'
      ? null
      : (h.agent.skills.find((s) => s.key === agentSkill) ?? null)

  // 输入框占位：选中某技能时显示该技能的示例文案（淡显 placeholder），否则走通用占位。
  // 用户一旦输入，真实文字即为 var(--foreground)（变亮），placeholder 自动让位。
  const inputPlaceholder = activeSkill?.preset || h.agent.placeholder

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
            <HeroTicker cfg={m.heroTicker} models={m.ticker} />
          </div>
        </section>

        {/* ============ 2. Canvas Agent ============ */}
        <section className='section section--tinted' id='home-agent'>
          <div className='container'>
            {/* 非对称头部：大标题两行居左（第二行灰）+ lead 右侧窄列 */}
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

            {/* 大输入面板：参考图 + 技能下拉 + helper + 圆形发送（对标站同款） */}
            <div className='agent-composer'>
              <textarea
                value={agentQ}
                onChange={(e) => setAgentQ(e.target.value)}
                placeholder={inputPlaceholder}
                aria-label={inputPlaceholder}
                rows={1}
              ></textarea>
              <div className='agent-composer-bar' ref={skillMenuRef}>
                <button type='button' className='agent-attach' aria-label={h.agent.attachLabel} title={h.agent.attachLabel}>
                  <Paperclip size={16} />
                </button>
                <div className='agent-skill' data-open={skillMenuOpen}>
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
                </div>
                <span className='agent-helper'>
                  <ShieldCheck size={14} aria-hidden='true' /> {h.agent.helperLabel}
                </span>
                <Nav className='agent-send' to='/prompt-gallery' aria-label={h.agent.sendLabel}>
                  <ArrowUp size={18} />
                </Nav>
                {skillMenuOpen && (
                  <div className='agent-skill-menu' role='listbox'>
                    <span className='agent-skill-menu-title'>
                      {h.agent.skillsMenuTitle}
                    </span>
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
                      <span className='agent-skill-ico'><Sparkles size={14} /></span>
                      <span className='agent-skill-label'>{h.agent.autoLabel}</span>
                      {agentSkill === 'auto' && <Check size={14} className='agent-skill-check' />}
                    </button>
                    <span className='agent-skill-divider' aria-hidden='true' />
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
                          <span className='agent-skill-ico'><Icon size={14} /></span>
                          <span className='agent-skill-label'>{s.label}</span>
                          {on && <Check size={14} className='agent-skill-check' />}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* 快捷技能 chips（与下拉框双向联动：key 同步选中） */}
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
        <ModelTicker models={m.ticker} tickerSec={m.tickerSec} />
      </div>
    </PublicLayout>
  )
}

export default GalleryHome
