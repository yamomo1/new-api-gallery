import { createFileRoute } from '@tanstack/react-router'

// 二开：工作台与画布合并 —— /workspace 直接接通画布首页
// 画布已编入 New API 二进制、由后端托管在 /studio/。
//
// 为什么在 beforeLoad 里 location.replace 而不是组件内跳：
// 组件方案要先渲染一帧 /workspace 再跳，地址栏会闪现
// /workspace → /studio/canvas 两段。beforeLoad 在路由解析阶段同步跳出，
// 地址栏只出现最终的 /studio/canvas，几乎无感。
// /studio 不是本 SPA 的路由，不能用 router 的 redirect()，必须走 location。

import { CanvasStudioRedirect } from '@/features/canvas/studio-redirect'

export const Route = createFileRoute('/_authenticated/workspace')({
  beforeLoad: () => {
    if (typeof window !== 'undefined') {
      window.location.replace('/studio/canvas')
    }
  },
  component: WorkspacePage,
})

function WorkspacePage() {
  // 兜底：正常情况下 beforeLoad 已跳走，只有不执行 JS 的环境才会渲染到这里
  return <CanvasStudioRedirect />
}
