/**
 * 后台「页面搭建」编辑器（Puck）
 * ------------------------------------------------------------------
 * 懒加载的 Puck 编辑器：用同一份 PUCK_CONFIG 渲染与首页一致的区块，
 * 用户拖拽/显隐/加区块后点 Publish → onPublish 把布局数据回写给父组件保存。
 *
 * iframe={false}：画布与主文档同树，我们的 Tailwind 令牌与
 * GalleryHomeDataContext 都能直接用（Puck 默认 iframe 会隔离这两者）。
 */
import { useState } from 'react'
import type { Data } from '@measured/puck'
import { Puck } from '@measured/puck'
import '@measured/puck/puck.css'

import { useGalleryHomeContent } from '@/features/gallery-home/api'
import { buildDefaultPuckData, PUCK_CONFIG } from '@/features/gallery-home/puck-config'
import { GalleryHomeDataProvider } from '@/features/gallery-home/sections'

export type PageBuilderProps = {
  initialData?: Data | null
  onPublish: (data: Data) => void
}

export default function PageBuilder({ initialData, onPublish }: PageBuilderProps) {
  // 内部持有布局状态，避免父组件重渲染时 Puck 被重置、丢未保存改动
  const [data, setData] = useState<Data>(() => initialData ?? buildDefaultPuckData())
  const { home, motion } = useGalleryHomeContent()

  return (
    <GalleryHomeDataProvider value={{ home, motion }}>
      <div className='ghome-puck-builder'>
        <Puck
          config={PUCK_CONFIG}
          data={data}
          iframe={{ enabled: false }}
          onPublish={(next) => {
            setData(next)
            onPublish(next)
          }}
        />
      </div>
    </GalleryHomeDataProvider>
  )
}
