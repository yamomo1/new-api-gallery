import { createFileRoute } from '@tanstack/react-router'

import { ImageGeneratorPage } from '@/features/ai-tool'
import { GalleryLayout } from '@/features/prompt-gallery/components/gallery-layout'

/**
 * 图片生成：/ai-tool/image-generator
 * UI 以 https://www.liblib.art/ai-tool/image-generator 为最终参考。
 * 与画廊共用侧边栏/顶栏外壳（侧边栏按钮可直接跳转）。
 */
export const Route = createFileRoute('/ai-tool/image-generator')({
  component: () => (
    <GalleryLayout>
      <ImageGeneratorPage />
    </GalleryLayout>
  ),
})
