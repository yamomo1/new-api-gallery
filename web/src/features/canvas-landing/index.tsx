/**
 * CanvasLanding —— 「画布工作室」落地页（/canvas）
 * ------------------------------------------------------------------
 * 对标 api.seedance.nz/canvas，1:1 复刻第三页。
 * 场景本体在 ./scene（StudioScene），首页第 3 屏用的是同一个组件（embed 模式），
 * 改文案/布局/动效只需改 scene.tsx + canvas-landing.css 一处。
 *
 * 动效清单见 scene.tsx 顶部注释；样式见 canvas-landing.css（作用域 .ctlp）。
 */
import { useTranslation } from 'react-i18next'

import { PublicLayout } from '@/components/layout'
import { useScrollReveal } from '@/hooks/use-scroll-reveal'

import { StudioScene } from './scene'

export function CanvasLanding() {
  const { t } = useTranslation()
  useScrollReveal('.ctlp')

  return (
    <PublicLayout showMainContainer={false}>
      <StudioScene
        as='h1'
        index='01'
        eyebrow={t('Canvas studio')}
        titleLines={[t('One idea.'), t('Every way to create.')]}
        lead={t(
          'A visual workspace for exploration, focused studios for speed, and stable model access when your idea becomes a product.',
        )}
      />
    </PublicLayout>
  )
}
