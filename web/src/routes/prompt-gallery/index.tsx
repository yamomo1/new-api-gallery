import { createFileRoute } from '@tanstack/react-router'
import z from 'zod'

import { PromptGallery } from '@/features/prompt-gallery'

const promptGallerySearchSchema = z.object({
  category: z.string().optional().catch(undefined),
})

export const Route = createFileRoute('/prompt-gallery/')({
  validateSearch: promptGallerySearchSchema,
  component: PromptGallery,
})
