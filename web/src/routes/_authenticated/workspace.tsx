import { createFileRoute } from '@tanstack/react-router'

// 二开：工作台（对标 api.seedance.nz/canvas 登录后首页）
import { WorkspacePage } from '@/features/workspace'

export const Route = createFileRoute('/_authenticated/workspace')({
  component: WorkspacePage,
})
