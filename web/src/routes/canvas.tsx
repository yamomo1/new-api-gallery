import { createFileRoute } from '@tanstack/react-router'

// 二开：站内画布入口 → 开源画布工作台（infinite-canvas）
// 不再自带画布编辑器，统一跳到独立部署的画布前端。
import { CanvasStudioRedirect } from '@/features/canvas/studio-redirect'

export const Route = createFileRoute('/canvas')({
  component: CanvasStudioPage,
})

function CanvasStudioPage() {
  return <CanvasStudioRedirect />
}
