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
import type { CSSProperties, ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { Link as TanstackLink } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import {
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  BookOpen,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  Film,
  Images,
  KeyRound,
  LayoutGrid,
  Paperclip,
  Play,
  ShieldCheck,
  Sparkles,
  Terminal,
  User,
  Video,
} from 'lucide-react'

/**
 * 极简语法高亮：字符串 / URL / 命令行参数 / 关键字 / 注释
 * 只覆盖首页 05 代码窗的三种示例（cURL / Python / Node.js），不追求完整解析。
 */
const CODE_TOKEN_RE =
  /("([^"\\]|\\.)*"|'([^'\\]|\\.)*'|https?:\/\/[^\s'"]+|-[A-Za-z]\b|\b(?:curl|from|import|const|let|await|async|new|print|return|export|def|console)\b)/g

function highlightCode(line: string, lineKey: number): ReactNode {
  if (/^\s*(#|\/\/)/.test(line)) {
    return <span className='api-tok-comment'>{line}</span>
  }
  const nodes: ReactNode[] = []
  let last = 0
  CODE_TOKEN_RE.lastIndex = 0
  let m = CODE_TOKEN_RE.exec(line)
  while (m) {
    const token = m[0]
    const isFlag = /^-[A-Za-z]$/.test(token)
    const prevChar = m.index > 0 ? line[m.index - 1] : ' '
    if (isFlag && !/\s/.test(prevChar)) {
      m = CODE_TOKEN_RE.exec(line)
      continue
    }
    if (m.index > last) nodes.push(line.slice(last, m.index))
    const cls = token.startsWith('http')
      ? 'api-tok-url'
      : /^["']/.test(token)
        ? 'api-tok-str'
        : isFlag
          ? 'api-tok-flag'
          : 'api-tok-key'
    nodes.push(
      <span key={`${lineKey}-${m.index}`} className={cls}>
        {token}
      </span>,
    )
    last = m.index + token.length
    m = CODE_TOKEN_RE.exec(line)
  }
  if (last < line.length) nodes.push(line.slice(last))
  return nodes.length ? nodes : '\u00a0'
}

/**
 * 03 作品卡：带视频的卡片在悬停/聚焦时播放，离开即暂停回到封面；
 * 悬停时右下角浮出箭头按钮，引导点击进入作品。
 */
function GalleryCard({
  item,
  big,
}: {
  item: {
    title: string
    model: string
    cover?: string
    video?: string
    kind?: string
    url: string
  }
  big?: boolean
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const play = () => {
    const v = videoRef.current
    if (!v) return
    v.play().catch(() => {})
  }
  const stop = () => {
    const v = videoRef.current
    if (!v) return
    v.pause()
    v.currentTime = 0
  }
  return (
    <Nav
      className={big ? 'gcard gcard--big fx-glow' : 'gcard fx-glow'}
      to={item.url}
      onMouseEnter={play}
      onMouseLeave={stop}
      onFocus={play}
      onBlur={stop}
    >
      {item.cover ? (
        <img
          className='gcard-art'
          src={item.cover}
          alt={item.title}
          loading='lazy'
          decoding='async'
        />
      ) : (
        <span className='gcard-ph'>YMM</span>
      )}
      {item.video && (
        <>
          <video
            ref={videoRef}
            className='gcard-video'
            src={item.video}
            poster={item.cover}
            muted
            loop
            playsInline
            preload='none'
          />
          <span className='gcard-play' aria-hidden='true'>
            <Play size={11} />
            {item.kind === 'video' ? 'VIDEO' : ''}
          </span>
        </>
      )}
      <div className='gcard-info'>
        <div className='gcard-title'>{item.title}</div>
        <div className='gcard-model'>{item.model}</div>
      </div>
      {/* 悬停引导：右下角箭头滑入 + 斜向轻推，提示可以点进去看提示词 */}
      <span className='gcard-cta' aria-hidden='true'>
        <ArrowUpRight size={16} />
      </span>
    </Nav>
  )
}

import { PublicLayout } from '@/components/layout'
import { StudioScene } from '@/features/canvas-landing/scene'
import { SiteFooter } from './footer'
import { useScrollReveal } from '@/hooks/use-scroll-reveal'
import { ensureFxGlowBound } from '@/lib/fx-glow'

import {
  HeroShowcaseCard,
  HeroTicker,
  HeroVideoStage,
  ModelTicker,
} from './components'
import { useGalleryFeed, useGalleryHomeContent } from './api'
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
  /** 03 提示词画廊筛选：0=全部 1=图片 2=视频（与 h.gallery.tabs 对齐） */
  const [galleryTab, setGalleryTab] = useState(0)
  /** 04 精选模型：当前悬停/选中的模型下标（左侧预览跟随） */
  const [modelActive, setModelActive] = useState(0)
  /** 05 开发者：代码示例标签页（cURL / Python / Node.js）与复制反馈 */
  const [codeTab, setCodeTab] = useState(0)
  const [copied, setCopied] = useState<'code' | 'base' | null>(null)
  /** 后台可能存了空行，渲染前先过滤掉没名字的项，避免出现空行 */
  const modelList = h.models.items.filter((mi) => (mi.name ?? '').trim() !== '')
  const activeModel = modelList[Math.min(modelActive, Math.max(0, modelList.length - 1))]
  /** 05 代码窗：当前标签下的示例代码 + 本站 API 基础地址 */
  /** 03 画廊：后台选了「最新/最热门」就吃画廊数据，否则用手选列表；
   *  自动来源为空（画廊还没作品）时回退到内置/手选数据，保证区块不空。 */
  const galleryFeed = useGalleryFeed(
    h.gallery.source ?? 'manual',
    h.gallery.limit ?? 10,
  )
  const galleryItems = galleryFeed.items.length
    ? galleryFeed.items
    : h.gallery.items
  /** 03 画廊：当前筛选下的可见作品；先按类型筛，再按后台「显示数量」截断。
   *  默认 5 条 = 一张大卡 + 四张小卡，只有一组，不会再往下多出一组。 */
  const galleryLimit = Math.min(Math.max(Number(h.gallery.limit) || 5, 1), 24)
  const galleryVisible = galleryItems
    .filter(
      (g) =>
        galleryTab === 0 ||
        (g.kind ?? 'image') === (galleryTab === 1 ? 'image' : 'video'),
    )
    .slice(0, galleryLimit)
  /**
   * 大卡位置：4 列网格里每 5 张一个循环 —— 1 张跨 2×2 + 4 张小卡正好两行，
   * 所以 5 张放 1 张、10 张放 2 张、15 张放 3 张，网格永远铺满不空边。
   */
  const galleryBigIdx = new Set<number>()
  for (let i = 0; i + 5 <= galleryVisible.length; i += 5) {
    galleryBigIdx.add(i)
  }

  const activeCode =
    [h.cta.code, h.cta.codePython, h.cta.codeNode][codeTab] ?? h.cta.code
  const apiBase = h.cta.apiBase || 'https://api.cdymm.com/v1'
  /** 胶囊滑动高亮块：跟随当前选中项的位置与宽度（真实测量，适配任意语种文案） */
  const galleryTabRefs = useRef<Array<HTMLButtonElement | null>>([])
  const [tabThumb, setTabThumb] = useState({ x: 0, w: 0 })

  // 鼠标跟随光晕：全局 pointermove 单例绑定（幂等）
  useEffect(() => {
    ensureFxGlowBound()
  }, [])

  useEffect(() => {
    const measure = () => {
      const el = galleryTabRefs.current[galleryTab]
      if (el) setTabThumb({ x: el.offsetLeft, w: el.offsetWidth })
    }
    measure()
    const ro = new ResizeObserver(measure)
    galleryTabRefs.current.forEach((el) => el && ro.observe(el))
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [galleryTab, h])

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

  // 滚动出现动画（scroll-reveal）：逻辑见 @/hooks/use-scroll-reveal
  //   1) [data-reveal]        单个元素淡入上浮（data-reveal-delay 毫秒错峰）
  //   2) [data-reveal-group]  盒子级：直接子元素自动逐个挂动画、按 data-reveal-step 错峰
  useScrollReveal('.ghome', [h, m, galleryTab])

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
                <Nav className='hero-btn-primary fx-glow' to={h.hero.primaryUrl}>
                  <Sparkles size={16} /> {h.hero.primaryLabel}
                </Nav>
                {h.hero.secondaryUrl && (
                  <a className='hero-btn-ghost fx-glow' href={h.hero.secondaryUrl}>
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
            <div className='agent-head' data-reveal-group data-reveal-step='90'>
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
            <div className='agent-composer' data-reveal-group data-reveal-step='110'>
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
            <div className='agent-chips' data-reveal-group data-reveal-step='55'>
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
              <ul className='agent-features' data-reveal-group data-reveal-step='120'>
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

              <div className='agent-preview' data-reveal-group data-reveal-step='100'>
                <div className='agent-preview-bubble'>
                  {h.agent.preview.bubble}
                </div>
                <div className='agent-preview-head'>
                  <span className='agent-preview-title'>
                    <Sparkles size={14} /> {h.agent.preview.title}
                  </span>
                  <span className='agent-preview-badge'>{h.agent.preview.badge}</span>
                </div>
                <ul className='agent-preview-plan' data-reveal-group data-reveal-step='90'>
                  {h.agent.preview.plan.map((p) => (
                    <li key={p}>
                      <Check size={14} /> {p}
                    </li>
                  ))}
                </ul>
                {/* 流程演示：角色定案 → 镜头 1 → 镜头 2 → 成片，逐个点亮 */}
                <div className='agent-steps'>
                  <div className='agent-preview-steps' data-reveal-group data-reveal-step='90'>
                    {h.agent.preview.steps.map((s, i) => {
                      const last = i === h.agent.preview.steps.length - 1
                      return (
                        <button
                          type='button'
                          key={s}
                          className={last ? 'is-final' : undefined}
                          style={{ '--i': i } as CSSProperties}
                        >
                          <i>{String(i + 1).padStart(2, '0')}</i>
                          <span>{s}</span>
                          {last && <Check size={12} className='agent-step-check' />}
                        </button>
                      )
                    })}
                  </div>
                  <span className='agent-steps-track' aria-hidden='true'>
                    <span className='agent-steps-fill' />
                  </span>
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

        {/* ============ 3. 画布工作室（对标第三页，1:1 复刻） ============ */}
        <section className='section' id='home-studios'>
          <div className='container'>
            <StudioScene
              embed
              as='h2'
              index={h.studios.index}
              eyebrow={t('Canvas studio')}
              titleLines={[t('One idea.'), t('Every way to create.')]}
              lead={h.studios.lead}
              media={{
                canvas: h.studios.items[0]?.image,
                image: h.studios.items[1]?.image,
                motion: h.studios.items[2]?.image,
              }}
              links={{
                image: h.studios.items[1]?.url ?? '/prompt-gallery',
                motion: h.studios.items[2]?.url ?? '/prompt-gallery',
              }}
              canvasBody={{
                title: h.studios.items[0]?.title ?? '',
                desc: h.studios.items[0]?.desc ?? '',
                cta: h.studios.items[0]?.cta ?? '',
                to: h.studios.items[0]?.url ?? '/canvas',
              }}
            />
          </div>
        </section>

        {/* ============ 4. 03 提示词画廊（对标站 1:1） ============ */}
        <section className='section section--tinted' id='home-gallery'>
          <div className='container'>
            {/* 头部：金色 03 眉标 + 两行大标题（第二行灰）+ 右侧窄列 lead */}
            <div className='gallery-head' data-reveal-group data-reveal-step='90'>
              <div className='gallery-head-copy'>
                <span className='eyebrow'>
                  <span className='sec-index'>{h.gallery.index}</span>
                  {h.gallery.eyebrow}
                </span>
                <h2 className='gallery-title'>
                  {h.gallery.title.split('\n').map((line, i, arr) => (
                    <span key={i}>
                      {i > 0 ? (
                        <span className='gallery-title-dim'>{line}</span>
                      ) : (
                        line
                      )}
                      {i < arr.length - 1 && <br />}
                    </span>
                  ))}
                </h2>
              </div>
              <p className='gallery-lead'>{h.gallery.lead}</p>
            </div>

            {/* 工具行：左侧筛选胶囊（可点，真实过滤）+ 右侧「探索画廊」 */}
            <div className='gallery-toolbar' data-reveal>
              <div className='gallery-tabs' role='group'>
                {/* 滑动高亮块：跟随选中的胶囊，切换时带弹性位移 + 光晕 */}
                <span
                  className='gallery-tabs-thumb'
                  aria-hidden='true'
                  style={{
                    transform: `translateX(${tabThumb.x}px)`,
                    width: tabThumb.w,
                    opacity: tabThumb.w ? 1 : 0,
                  }}
                >
                  <span className='gallery-tabs-sheen' key={galleryTab} />
                </span>
                {h.gallery.tabs.map((tab, i) => (
                  <button
                    key={tab}
                    ref={(el) => {
                      galleryTabRefs.current[i] = el
                    }}
                    type='button'
                    aria-pressed={galleryTab === i}
                    onClick={() => setGalleryTab(i)}
                  >
                    <span>{tab}</span>
                  </button>
                ))}
              </div>
              <Nav className='gallery-explore' to='/prompt-gallery'>
                <span className='gallery-explore-label'>
                  {h.gallery.exploreLabel}
                </span>
                <ArrowUpRight size={14} />
              </Nav>
            </div>

            {/* 作品网格：无论哪个筛选，首卡都跨 2×2（左大图 + 右侧小图） */}
            <div
              className='gallery-grid'
              key={galleryTab}
              data-reveal-group
              data-reveal-step='95'
            >
              {galleryVisible.map((g, i) => (
                <GalleryCard key={g.title} item={g} big={galleryBigIdx.has(i)} />
              ))}
              {galleryVisible.length === 0 && (
                <div className='gallery-empty'>{t('No works yet')}</div>
              )}
            </div>

            <div className='center' data-reveal>
              <Nav className='gallery-link' to='/prompt-gallery'>
                {h.gallery.exploreLabel} <ArrowRight size={14} />
              </Nav>
            </div>
          </div>
        </section>

        {/* ============ 5. 精选模型（对标 04：左预览 + 右列表悬停换图） ============ */}
        <section className='section' id='home-models'>
          <div className='container'>
            <div className='models-head' data-reveal-group data-reveal-step='90'>
              <div className='models-head-copy'>
                <span className='eyebrow'>
                  <span className='sec-index'>{h.models.index}</span>
                  {h.models.eyebrow}
                </span>
                <h2 className='models-title'>{h.models.title}</h2>
              </div>
              <div className='models-head-side'>
                <p className='models-lead'>{h.models.lead}</p>
                <dl className='models-stats'>
                  <div>
                    <dd>{h.models.stats.models}</dd>
                    <dt>{t('Available models')}</dt>
                  </div>
                  <div>
                    <dd>{h.models.stats.providers}</dd>
                    <dt>{t('Providers')}</dt>
                  </div>
                </dl>
              </div>
            </div>

            <div className='models-body'>
              {/* 左侧预览：所有模型图叠放，选中/悬停淡入切换 */}
              <div className='models-preview' data-reveal>
                <div className='models-preview-stack'>
                  {modelList.map((mi, i) => (
                    <img
                      key={`${mi.name}-${i}`}
                      className={i === modelActive ? 'is-on' : undefined}
                      src={mi.thumb}
                      alt=''
                      loading='lazy'
                      decoding='async'
                    />
                  ))}
                </div>
                <div className='models-caption'>
                  <span className='models-kind' key={`k-${modelActive}`}>
                    {activeModel?.category ?? ''}
                  </span>
                  <p key={`n-${modelActive}`}>
                    {activeModel?.name ?? ''}
                  </p>
                </div>
              </div>

              {/* 右侧列表：与左侧预览等高，可滚轮滚动；悬停即切换左侧预览 */}
              <div className='models-list-wrap'>
              <div className='models-list' data-reveal-group data-reveal-step='45'>
                {modelList.map((mi, i) => (
                  <Nav
                    className='model-row'
                    to={mi.url}
                    key={`${mi.name}-${i}`}
                    data-active={i === modelActive ? 'true' : 'false'}
                    onMouseEnter={() => setModelActive(i)}
                    onFocus={() => setModelActive(i)}
                  >
                    <span className='model-row-index' aria-hidden='true'>
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className='model-row-name'>{mi.name}</span>
                    <span className='model-row-meta'>
                      {mi.category}
                      {mi.capability && (
                        <span className='model-row-cap'>{mi.capability}</span>
                      )}
                    </span>
                    <ArrowUpRight className='model-row-arrow' size={18} />
                  </Nav>
                ))}
              </div>
              </div>
            </div>

            <div className='center' data-reveal>
              <Nav className='gallery-link' to='/pricing'>
                {h.models.exploreLabel} <ArrowRight size={14} />
              </Nav>
            </div>
          </div>
        </section>

        {/* ============ 6. 开发者 API（对标 05：左文案 + 右代码窗） ============ */}
        <section className='section api' id='home-api'>
          <div className='container'>
            <div className='api-grid'>
              {/* —— 左列 —— */}
              <div className='api-left' data-reveal-group data-reveal-step='90'>
                <span className='eyebrow'>
                  <span className='sec-index'>{h.cta.index}</span>
                  {h.cta.eyebrow}
                </span>
                <h2 className='api-title'>{h.cta.title}</h2>
                <p className='api-lead'>{h.cta.lead}</p>

                <ul className='api-features' data-reveal-group data-reveal-step='70'>
                  {h.cta.features.map((f, i) => (
                    <li key={f}>
                      <span className='api-feature-icon' aria-hidden='true'>
                        {i === 0 ? (
                          <Terminal size={18} />
                        ) : i === 1 ? (
                          <KeyRound size={18} />
                        ) : (
                          <ShieldCheck size={18} />
                        )}
                      </span>
                      <span className='api-feature-copy'>
                        <b>{f}</b>
                        {h.cta.featureDescs?.[i] && (
                          <span>{h.cta.featureDescs[i]}</span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className='api-actions' data-reveal>
                  <Nav className='api-primary' to={h.cta.connectUrl}>
                    <KeyRound size={16} />
                    <span>{h.cta.genLabel}</span>
                    <ArrowRight size={14} className='api-primary-arrow' />
                  </Nav>
                  <Nav className='api-ghost' to='/docs'>
                    <BookOpen size={16} />
                    <span>{h.cta.docsLabel}</span>
                    <ArrowUpRight size={14} />
                  </Nav>
                </div>

                <div className='api-connect' data-reveal>
                  <div className='api-connect-copy'>
                    <span className='api-connect-kicker'>
                      {h.cta.connectKicker}
                    </span>
                    <h3>{h.cta.connectTitle}</h3>
                    <ul>
                      {h.cta.connectPoints.map((p) => (
                        <li key={p}>{p}</li>
                      ))}
                    </ul>
                    <div className='api-connect-actions'>
                      <Nav className='api-connect-primary' to={h.cta.connectUrl}>
                        {h.cta.connectPrimaryLabel}
                        <ChevronRight size={14} />
                      </Nav>
                      <Nav
                        className='api-connect-ghost'
                        to={h.cta.connectSecondaryUrl}
                      >
                        {h.cta.connectSecondaryLabel}
                      </Nav>
                    </div>
                  </div>
                  {/* 右：接入 → 成功 → 出图 的三步小流程（纯装饰，循环播放） */}
                  <div className='api-flow' aria-hidden='true'>
                    <div className='api-flow-step api-flow-cmd'>
                      <span className='api-flow-prompt'>&gt;</span>
                      <span className='api-flow-text'>ymm connect</span>
                      <i className='api-flow-caret' />
                    </div>
                    <div className='api-flow-step api-flow-ok'>
                      <span className='api-flow-check'>
                        <Check size={10} />
                      </span>
                      <span className='api-flow-text'>connected</span>
                    </div>
                    <div className='api-flow-step api-flow-img'>
                      <img src='/images/home/model-image-v4.webp' alt='' loading='lazy' />
                      <span className='api-flow-tag'>
                        <Sparkles size={9} /> image.webp
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* —— 右列：代码窗（标签切换 + 复制 + 逐行入场） —— */}
              <figure className='api-code' data-reveal>
                <div className='api-code-head'>
                  <span className='api-dots' aria-hidden='true'>
                    <i />
                    <i />
                    <i />
                  </span>
                  <div className='api-tabs' role='tablist'>
                    {h.cta.codeTabs.map((tab, i) => (
                      <button
                        key={tab}
                        type='button'
                        role='tab'
                        aria-selected={codeTab === i}
                        className={codeTab === i ? 'is-on' : undefined}
                        onClick={() => setCodeTab(i)}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>
                  <button
                    type='button'
                    className='api-copy'
                    aria-label={t('Copy code')}
                    onClick={() => {
                      const text = activeCode
                      navigator.clipboard?.writeText(text).then(() => {
                        setCopied('code')
                        setTimeout(() => setCopied(null), 1600)
                      })
                    }}
                  >
                    {copied === 'code' ? <Check size={15} /> : <Copy size={15} />}
                  </button>
                </div>

                <div className='api-base'>
                  <span className='api-base-label'>{h.cta.codeTitle}</span>
                  <code className='api-base-url'>{apiBase}</code>
                  <button
                    type='button'
                    className='api-copy'
                    aria-label={t('Copy base URL')}
                    onClick={() => {
                      navigator.clipboard?.writeText(apiBase).then(() => {
                        setCopied('base')
                        setTimeout(() => setCopied(null), 1600)
                      })
                    }}
                  >
                    {copied === 'base' ? <Check size={15} /> : <Copy size={15} />}
                  </button>
                </div>

                <pre className='api-code-body' key={codeTab}>
                  {activeCode.split('\n').map((line, i) => (
                    <span
                      className='api-code-line'
                      key={i}
                      style={{ animationDelay: `${i * 24}ms` }}
                    >
                      {line ? highlightCode(line, i) : '\u00a0'}
                      {'\n'}
                    </span>
                  ))}
                </pre>
              </figure>
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
            <div className='home-closing-inner' data-reveal-group data-reveal-step='120'>
              <p className='home-closing-kicker'>
                <Sparkles size={16} /> {h.closing.kicker}
              </p>
              <h2 id='home-closing-title' className='home-closing-title'>
                {h.closing.title}
              </h2>
              <p className='home-closing-lede'>{h.closing.lead}</p>
              <div className='home-closing-actions'>
                <Nav className='home-closing-primary' to={h.closing.primaryUrl}>
                  {h.closing.primaryLabel}
                  <ChevronRight size={15} />
                </Nav>
                <Nav className='home-closing-ghost' to={h.closing.secondaryUrl}>
                  {h.closing.secondaryLabel}
                </Nav>
              </div>
            </div>
          </div>
        </section>

        {/* ============ 8. 页脚上方模型滚动条 ============ */}
        <div data-reveal>
          <ModelTicker models={m.ticker} tickerSec={m.tickerSec} />
        </div>
      </div>

      {/* ============ 9. 页脚（后台「二开设置 → 首页设置 → Footer」可编辑） ============ */}
      <SiteFooter data={h.footer} />
    </PublicLayout>
  )
}

export default GalleryHome
