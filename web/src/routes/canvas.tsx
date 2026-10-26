import { createFileRoute } from '@tanstack/react-router'

// 二开：画布工作室落地页（对标 api.seedance.nz/canvas）
import { CanvasLanding } from '@/features/canvas-landing'

export const Route = createFileRoute('/canvas')({
  component: CanvasLanding,
})
