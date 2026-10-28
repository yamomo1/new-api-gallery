import { createFileRoute } from '@tanstack/react-router'
import z from 'zod'

import { PromptGallery } from '@/features/prompt-gallery'

const promptGallerySearchSchema = z.object({
  category: z.string().optional().catch(undefined),
  /** 作品深链：/prompt-gallery?prompt=123 直接打开详情弹窗 */
  prompt: z.coerce.number().optional().catch(undefined),
})

export const Route = createFileRoute('/prompt-gallery/')({
  validateSearch: promptGallerySearchSchema,
  component: PromptGallery,
})
