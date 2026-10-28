import { createFileRoute } from '@tanstack/react-router'
import z from 'zod'

import { MyWorks } from '@/features/prompt-gallery/my-works'

const myWorksSearchSchema = z.object({
  /** 从画廊页「发布作品」跳转时自动打开投稿弹窗 */
  create: z.boolean().optional().catch(undefined),
})

export const Route = createFileRoute('/_authenticated/my-works/')({
  validateSearch: myWorksSearchSchema,
  component: MyWorks,
})
