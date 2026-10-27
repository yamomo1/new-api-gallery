/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { createFileRoute, redirect } from '@tanstack/react-router'
import { useAuthStore } from '@/stores/auth-store'

// 二开：首页替换为电影感画廊首页（原官方首页在 @/features/home，可随时切回）
import { GalleryHome } from '@/features/gallery-home'

export const Route = createFileRoute('/')({
  // 已登录用户访问公开画廊首页时自动进入工作台（对标站 /canvas 行为）
  beforeLoad: async () => {
    const { auth } = useAuthStore.getState()
    if (auth.user && auth.accessToken) {
      throw redirect({ to: '/workspace', replace: true })
    }
  },
  component: GalleryHome,
})
