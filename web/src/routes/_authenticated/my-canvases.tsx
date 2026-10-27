import { createFileRoute } from '@tanstack/react-router'

import { MyCanvases } from '@/features/canvas/my-canvases'

export const Route = createFileRoute('/_authenticated/my-canvases')({
  component: MyCanvases,
})
