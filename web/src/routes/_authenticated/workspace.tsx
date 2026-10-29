import { createFileRoute } from '@tanstack/react-router'

// 二开：工作台与画布合并 —— /workspace 直接接通画布首页
// 画布已编入 New API 二进制、由后端托管在 /studio/，点击「工作台」即进入画布编辑器首页，
// 与 /canvas、/canvas/:id 共用同一画布工作台（避免重复维护独立页面）。
import { CanvasStudioRedirect } from '@/features/canvas/studio-redirect'

export const Route = createFileRoute('/_authenticated/workspace')({
  component: WorkspacePage,
})

function WorkspacePage() {
  return <CanvasStudioRedirect />
}
