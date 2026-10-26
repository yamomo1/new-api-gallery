/**
 * GalleryHome —— 电影感画廊首页（移植自 gallery-frontend，适配 New API）
 * ------------------------------------------------------------------
 * 区块流（与对标站一致）：Hero / Canvas Agent / Studios / Gallery /
 * Models / API CTA / Closing / ModelTicker。
 *
 * 渲染方式：用 Puck 的 <Render> 按后台「页面搭建」里保存的布局（HomeConfig.puck）
 * 渲染。Puck 只管「哪个区块、什么顺序、显隐」；每个区块的内容从
 * GalleryHomeDataContext 读取（后台语种分桶已解析好的文案），与 Puck 解耦。
 * 未配置 puck 时回退到默认 8 区块顺序（buildDefaultPuckData）。
 *
 * 动效：home-settle 2.4s 落定 / home-rise 0.7s stagger 上浮 / home-bob 浮卡轻浮
 * 样式：gallery-home.css（作用域 .ghome，颜色继承 New API 主题变量 → 换肤联动）
 */
import { Render } from '@measured/puck'

import { PublicLayout } from '@/components/layout'

import { useGalleryHomeContent } from './api'
import { buildDefaultPuckData, PUCK_CONFIG } from './puck-config'
import { GalleryHomeDataProvider } from './sections'
import './gallery-home.css'

export function GalleryHome() {
  const { home, motion, puck } = useGalleryHomeContent()

  // 没有保存过布局 → 用默认 8 区块顺序；保存过但 content 为空也回退
  const puckData =
    puck && Array.isArray(puck.content) && puck.content.length > 0
      ? (puck as Parameters<typeof Render>[0]['data'])
      : buildDefaultPuckData()

  return (
    <PublicLayout showMainContainer={false}>
      <GalleryHomeDataProvider value={{ home, motion }}>
        <div className='ghome'>
          <Render data={puckData} config={PUCK_CONFIG} />
        </div>
      </GalleryHomeDataProvider>
    </PublicLayout>
  )
}

export default GalleryHome
