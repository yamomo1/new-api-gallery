import { createFileRoute, redirect } from '@tanstack/react-router'

import { AdminPromptGalleryReview } from '@/features/prompt-gallery/admin-review'
import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

export const Route = createFileRoute('/_authenticated/admin/prompt-gallery/')({
  beforeLoad: () => {
    const { auth } = useAuthStore.getState()
    if (!auth.user || auth.user.role < ROLE.ADMIN) {
      throw redirect({ to: '/403' })
    }
  },
  component: AdminPromptGalleryReview,
})
