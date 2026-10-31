import { createFileRoute } from '@tanstack/react-router'
import z from 'zod'

import { PromptGallery } from '@/features/prompt-gallery'

const promptGallerySearchSchema = z.object({
  category: z.string().optional().catch(undefined),
  /** 标签深链：/prompt-gallery?tag=国风 直接应用标签筛选 */
  tag: z.string().optional().catch(undefined),
  /** 关键词深链（详情页顶部搜索框）：/prompt-gallery?search=xxx */
  search: z.string().optional().catch(undefined),
  /** 旧版作品深链：/prompt-gallery?prompt=123（已改为跳转 /prompt-gallery/123） */
  prompt: z.coerce.number().optional().catch(undefined),
})

export const Route = createFileRoute('/prompt-gallery/')({
  validateSearch: promptGallerySearchSchema,
  component: PromptGallery,
})
