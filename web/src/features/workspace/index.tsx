/**
 * 工作台（对标 api.seedance.nz/canvas 登录后首页）
 * ------------------------------------------------------------------
 * 结构：营销条 → 空间 Tab → Agent Hero（大输入框 + 技能 chips）→ 个人作品区。
 * Agent 生成能力第一版为 UI 占位，作品数据来自画廊「我的作品 + 项目分组」。
 */
import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from '@tanstack/react-router'
import {
  ArrowUp,
  LayoutPanelLeft,
  Library,
  Paperclip,
  Sparkles,
  X,
} from 'lucide-react'
import { toast } from 'sonner'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

import { WorksSection } from './works-section'
import './workspace.css'

const SKILL_CHIPS = [
  { key: 'characters', icon: 'Aa', sample: '一套角色设定集：主角三视图、表情包与服装方案' },
  { key: 'storyboard', icon: '▦', sample: '画板分镜：把一段剧情拆成 6 格分镜画面' },
  { key: 'multishot', icon: '▶', sample: '多镜头短视频：一个产品广告的 4 镜头脚本与画面' },
  { key: 'poster', icon: '◫', sample: '系列海报：同一种风格的三张电影感海报' },
  { key: 'picturebook', icon: '❐', sample: '多页绘本：一本 6 页水彩绘本，讲述小猫学习分享的故事' },
] as const

const PROMO_DISMISS_KEY = 'wk-promo-dismissed'

export function WorkspacePage() {
  const { t } = useTranslation()
  const [promoOpen, setPromoOpen] = useState(() => {
    try {
      return localStorage.getItem(PROMO_DISMISS_KEY) !== '1'
    } catch {
      return true
    }
  })
  const [idea, setIdea] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const dismissPromo = () => {
    setPromoOpen(false)
    try {
      localStorage.setItem(PROMO_DISMISS_KEY, '1')
    } catch {
      /* ignore */
    }
  }

  const submitIdea = () => {
    if (!idea.trim()) {
      inputRef.current?.focus()
      return
    }
    toast.info(t('Canvas Agent is coming soon — describe your idea and generate later'))
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submitIdea()
    }
  }

  const skillChips = useMemo(
    () =>
      SKILL_CHIPS.map((chip) => ({
        ...chip,
        label: t(`workspace.chip.${chip.key}`),
      })),
    [t]
  )

  return (
    <div className='wk'>
      {promoOpen && (
        <div className='wk-promo'>
          <div className='wk-promo-inner'>
            <span className='wk-promo-text'>
              {t('workspace.promo.tagline')}
              <span className='wk-promo-dot'>·</span>
              <span className='wk-promo-strong'>{t('workspace.promo.agent')}</span>
            </span>
            <button type='button' className='wk-promo-cta' onClick={submitIdea}>
              {t('workspace.promo.cta')}
            </button>
          </div>
          <button
            type='button'
            className='wk-promo-close'
            aria-label={t('Close')}
            onClick={dismissPromo}
          >
            <X size={15} />
          </button>
        </div>
      )}

      <div className='wk-space-tabs'>
        <span className='wk-space-tab wk-space-tab-active'>
          <Library size={14} />
          {t('workspace.tab.workspace')}
        </span>
        <Link to='/prompt-gallery' className='wk-space-tab'>
          <LayoutPanelLeft size={14} />
          {t('workspace.tab.gallery')}
        </Link>
      </div>

      <section className='wk-hero'>
        <div className='wk-hero-badge'>
          <Sparkles size={13} />
          <span>{t('workspace.hero.badge')}</span>
          <em>NEW</em>
        </div>
        <h1 className='wk-hero-title'>{t('workspace.hero.title')}</h1>
        <p className='wk-hero-sub'>{t('workspace.hero.subtitle')}</p>

        <div className='wk-composer'>
          <textarea
            ref={inputRef}
            className='wk-composer-input'
            rows={2}
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={t('workspace.composer.placeholder')}
          />
          <div className='wk-composer-bar'>
            <div className='wk-composer-left'>
              <button
                type='button'
                className='wk-composer-icon'
                aria-label={t('Attach reference image')}
                onClick={() =>
                  toast.info(t('Reference image upload is coming soon'))
                }
              >
                <Paperclip size={15} />
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <button type='button' className='wk-composer-mode'>
                      <span className='wk-composer-mode-dot' />
                      {t('workspace.composer.auto')}
                    </button>
                  }
                />
                <DropdownMenuContent align='start'>
                  <DropdownMenuItem>{t('workspace.composer.auto')}</DropdownMenuItem>
                  <DropdownMenuItem disabled>
                    {t('workspace.composer.imageOnly')}
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled>
                    {t('workspace.composer.videoOnly')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <span className='wk-composer-note'>
                {t('workspace.composer.confirmNote')}
              </span>
            </div>
            <button
              type='button'
              className='wk-composer-send'
              aria-label={t('Send')}
              onClick={submitIdea}
            >
              <ArrowUp size={17} />
            </button>
          </div>
        </div>

        <div className='wk-chips'>
          {skillChips.map((chip) => (
            <button
              key={chip.key}
              type='button'
              className='wk-chip'
              onClick={() => setIdea(chip.sample)}
            >
              <span className='wk-chip-icon'>{chip.icon}</span>
              {chip.label}
            </button>
          ))}
        </div>
      </section>

      <WorksSection />
    </div>
  )
}
