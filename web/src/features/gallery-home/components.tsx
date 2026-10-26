/**
 * GalleryHome 子组件（移植自 gallery-frontend components/）
 * HeroVideoStage / HeroTicker / HeroShowcaseCard / ModelTicker
 */
import { useState } from 'react'

import { MOTION_DATA, type HeroCardConfig } from './data'

/* ---------------- HeroVideoStage：首屏视频背景（多段顺序播放） ---------------- */
export function HeroVideoStage({ videos }: { videos: string[] }) {
  const [i, setI] = useState(0)
  const list = videos.filter(Boolean)
  if (!list.length) return null
  const cur = list[Math.min(i, list.length - 1)]

  return (
    // biome-ignore lint/a11y/noMediaAutoplay: 装饰性 muted 背景视频，对标站同款
    <video
      key={cur}
      className='home-hero-video'
      src={cur}
      autoPlay
      muted
      playsInline
      preload='auto'
      onEnded={() => setI((prev) => (prev + 1) % list.length)}
    />
  )
}

/* ---------------- HeroTicker：Hero 面板内底部模型滚动条 ---------------- */
export function HeroTicker() {
  const cfg = MOTION_DATA.heroTicker
  const models = MOTION_DATA.ticker
  if (!cfg.enabled || !models.length) return null

  const dur = Math.max(8, cfg.durationSec || 42)
  const style = {
    ['--ht-dur' as string]: `${dur}s`,
    ['--ht-bg' as string]: cfg.bg,
    ['--ht-dot' as string]: cfg.dot,
    ['--ht-text' as string]: cfg.text,
  }

  const list = (ariaHidden: boolean) => (
    <span className='hero-ticker-list' aria-hidden={ariaHidden || undefined}>
      {models.map((m) => (
        <span className='hero-ticker-item' key={m}>
          <i className='hero-ticker-dot' />
          {m}
        </span>
      ))}
    </span>
  )

  return (
    <div className='hero-ticker' style={style}>
      {cfg.prefix && <b className='hero-ticker-prefix'>{cfg.prefix}</b>}
      <div className='hero-ticker-viewport'>
        <div className='hero-ticker-track'>
          {list(false)}
          {list(true)}
        </div>
      </div>
    </div>
  )
}

/* ---------------- HeroShowcaseCard：右上浮动四像生成卡 ---------------- */
export function HeroShowcaseCard({ card }: { card: HeroCardConfig }) {
  if (!card.enabled) return null
  const imgs = card.images.filter(Boolean)
  const main = imgs[0]
  const thumbs = imgs.slice(1, 3)

  return (
    <aside className='hero-card' aria-label={card.tag}>
      <div className='hero-card-head'>
        <span className='hero-card-tag'>
          <i className='hero-card-dot' /> {card.tag}
        </span>
        <p className='hero-card-title'>{card.title}</p>
        <div className='hero-card-params'>
          <span>{card.model}</span>
          <i>·</i>
          <span>{card.ratio}</span>
          <i>·</i>
          <span>{card.count}</span>
        </div>
      </div>

      <div className='hero-card-media'>
        {main ? (
          <img
            className='hero-card-main'
            src={main}
            alt={card.title}
            loading='lazy'
          />
        ) : (
          <span className='hero-card-ph hero-card-main' />
        )}
        <div className='hero-card-thumbs'>
          {[0, 1].map((i) =>
            thumbs[i] ? (
              <img key={i} src={thumbs[i]} alt='' loading='lazy' />
            ) : (
              <span
                key={i}
                className='hero-card-ph'
                style={{ ['--ph-h' as string]: String(60 + i * 37) }}
              />
            ),
          )}
        </div>
      </div>

      <div className='hero-card-pages'>
        {imgs.map((_, i) => (
          <span key={i} className={i === 0 ? 'on' : ''}>
            {i + 1}/{imgs.length}
          </span>
        ))}
      </div>
    </aside>
  )
}

/* ---------------- ModelTicker：页脚上方模型滚动条 ---------------- */
export function ModelTicker() {
  const models = MOTION_DATA.ticker
  if (!models.length) return null

  const text = models.join('　✦　')
  const durSec = Math.max(8, MOTION_DATA.tickerSec ?? 30)

  return (
    <div className='model-ticker marquee'>
      <div
        className='marquee-track'
        style={{ ['--marquee-dur' as string]: `${durSec}s` }}
      >
        <span className='ticker-item'>Recently launched　✦　{text}</span>
        <span className='ticker-item' aria-hidden='true'>
          Recently launched　✦　{text}
        </span>
      </div>
    </div>
  )
}
