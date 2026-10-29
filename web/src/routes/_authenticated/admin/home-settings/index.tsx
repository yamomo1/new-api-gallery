import { createFileRoute, redirect } from '@tanstack/react-router'

import { HomeSettings } from '@/features/home-settings'
import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

export const Route = createFileRoute('/_authenticated/admin/home-settings/')({
  beforeLoad: () => {
    const { auth } = useAuthStore.getState()
    if (!auth.user || auth.user.role < ROLE.SUPER_ADMIN) {
      throw redirect({ to: '/403' })
    }
  },
  component: HomeSettings,
})
