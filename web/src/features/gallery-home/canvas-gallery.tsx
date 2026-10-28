/*
 * 二开：首页「画布广场」区块
 * ------------------------------------------------------------------
 * 展示用户在画布工作台（infinite-canvas）里创作、并发布为 public 的画布。
 * - 数据来自免登录接口 /api/canvas/v1/gallery
 * - 没有公开画布时整块不渲染，避免线上出现空区块
 * - 点击卡片跳转画布工作台 ?open=<id>，在那里打开/二次创作
 */
import type { CSSProperties } from 'react'
import { ArrowRight, ArrowUpRight, Frame } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  usePublicCanvases,
  type PublicCanvasSummary,
} from '@/features/canvas/public-gallery'
import {
  CANVAS_STUDIO_URL,
  canvasStudioUrl,
} from '@/features/canvas/studio'

/** 用标题做稳定哈希 → 色相，保证没有封面时每张卡的颜色固定且互不相同 */
function hueOf(seed: string): number {
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 360
  }
  return hash
}

function formatDate(timestamp: number, locale: string): string {
  if (!timestamp) return ''
  try {
    return new Date(timestamp * 1000).toLocaleDateString(locale, {
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return ''
  }
}

function CanvasCard({ item }: { item: PublicCanvasSummary }) {
  const { i18n } = useTranslation()
  const href = canvasStudioUrl(item.id)
  const title = item.title || 'Untitled'
  const hue = hueOf(title)
  const meta = [item.author, formatDate(item.updated_at, i18n.language)]
    .filter(Boolean)
    .join(' · ')

  const content = (
    <>
      <div className='canvas-card-cover'>
        {item.thumbnail ? (
          <img
            className='canvas-card-art'
            src={item.thumbnail}
            alt={title}
            loading='lazy'
          />
        ) : (
          <span
            className='canvas-card-ph'
            style={{ '--canvas-hue': hue } as CSSProperties}
          >
            <Frame size={22} />
            <b>{title.slice(0, 1).toUpperCase()}</b>
          </span>
        )}
        {href && (
          <span className='canvas-card-cta' aria-hidden='true'>
            <ArrowUpRight size={15} />
          </span>
        )}
      </div>
      <div className='canvas-card-meta'>
        <strong title={title}>{title}</strong>
        {item.description && <p>{item.description}</p>}
        <span>{meta}</span>
      </div>
    </>
  )

  if (!href) {
    return <div className='canvas-card'>{content}</div>
  }
  return (
    <a
      className='canvas-card'
      href={href}
      target='_blank'
      rel='noopener noreferrer'
    >
      {content}
    </a>
  )
}

export function CanvasGallerySection() {
  const { t } = useTranslation()
  const { items } = usePublicCanvases(8)

  // 还没有人发布公开画布时不占位，首页保持原有节奏
  if (items.length === 0) return null

  return (
    <section className='section' id='home-canvases'>
      <div className='container'>
        <div className='gallery-head' data-reveal-group data-reveal-step='90'>
          <div className='gallery-head-copy'>
            <span className='eyebrow'>
              <span className='canvas-index'>NEW</span>
              {t('Canvas gallery')}
            </span>
            <h2 className='gallery-title'>
              {t('Canvases made by the community')}
            </h2>
          </div>
          <p className='gallery-lead'>
            {t(
              'Open a canvas to see how it was wired: nodes, prompts and references, all still editable.'
            )}
          </p>
        </div>

        <div
          className={`canvas-grid${items.length < 4 ? ' canvas-grid--few' : ''}`}
          data-reveal-group
          data-reveal-step='80'
        >
          {items.map((item) => (
            <CanvasCard key={item.id} item={item} />
          ))}
        </div>

        {CANVAS_STUDIO_URL && (
          <div className='center' data-reveal>
            <a
              className='gallery-link'
              href={CANVAS_STUDIO_URL}
              target='_blank'
              rel='noopener noreferrer'
            >
              {t('Create your own canvas')} <ArrowRight size={14} />
            </a>
          </div>
        )}
      </div>
    </section>
  )
}
