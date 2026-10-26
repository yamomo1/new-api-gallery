import { createFileRoute } from '@tanstack/react-router'

import { MyWorks } from '@/features/prompt-gallery/my-works'

export const Route = createFileRoute('/_authenticated/my-works/')({
  component: MyWorks,
})
