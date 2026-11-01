import { createFileRoute } from '@tanstack/react-router'

import { VideoGeneratorPage } from '@/features/ai-tool'
import { GalleryLayout } from '@/features/prompt-gallery/components/gallery-layout'

/**
 * 视频生成：/ai-tool/video-generator
 * UI 以 https://www.liblib.art/ai-tool/video-generator 为最终参考。
 */
export const Route = createFileRoute('/ai-tool/video-generator')({
  component: () => (
    <GalleryLayout>
      <VideoGeneratorPage />
    </GalleryLayout>
  ),
})
