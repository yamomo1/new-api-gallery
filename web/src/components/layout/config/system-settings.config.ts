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
import type { TFunction } from 'i18next'
import {
  Box,
  HardDrive,
  Images,
  Route,
  CreditCard,
  Layout,
  Settings,
  Shield,
  ShieldAlert,
  Wrench,
} from 'lucide-react'

import { getAuthSectionNavItems } from '@/features/system-settings/auth/section-registry.tsx'
import { getBillingSectionNavItems } from '@/features/system-settings/billing/section-registry.tsx'
import { getContentSectionNavItems } from '@/features/system-settings/content/section-registry.tsx'
import { getModelsSectionNavItems } from '@/features/system-settings/models/section-registry.tsx'
import { getOperationsSectionNavItems } from '@/features/system-settings/operations/section-registry.tsx'
import { getPolicySectionNavItems } from '@/features/system-settings/request-policies/section-registry'
import { getSecuritySectionNavItems } from '@/features/system-settings/security/section-registry.tsx'
import { getSiteSectionNavItems } from '@/features/system-settings/site/section-registry.tsx'

import type { NavGroup, SidebarView } from '../types'

/**
 * Sidebar nav groups for the System Settings nested view.
 *
 * Kept as a single group because the workspace title in the sidebar
 * header already provides top-level context — the inner group label
 * scopes the items as "administration" actions.
 */
function getSystemSettingsNavGroups(t: TFunction): NavGroup[] {
  return [
    {
      id: 'system-administration',
      title: t('System Administration'),
      items: [
        {
          title: t('Site & Branding'),
          icon: Settings,
          items: getSiteSectionNavItems(t),
        },
        {
          title: t('Authentication'),
          icon: Shield,
          items: getAuthSectionNavItems(t),
        },
        {
          title: t('Billing & Payment'),
          icon: CreditCard,
          items: getBillingSectionNavItems(t),
        },
        {
          title: t('Models'),
          icon: Box,
          items: getModelsSectionNavItems(t),
        },
        {
          title: t('Request policies'),
          icon: Route,
          items: getPolicySectionNavItems(t),
        },
        {
          title: t('Security & Limits'),
          icon: ShieldAlert,
          items: getSecuritySectionNavItems(t),
        },
        {
          title: t('Console Content'),
          icon: Layout,
          items: getContentSectionNavItems(t),
        },
        {
          title: t('Operations'),
          icon: Wrench,
          items: getOperationsSectionNavItems(t),
        },
        {
          title: t('storage.group', { defaultValue: '存储' }),
          icon: HardDrive,
          items: [
            {
              title: t('storage.nav', { defaultValue: '存储设置' }),
              url: '/system-settings/storage',
            },
          ],
        },
        {
          title: t('Fork settings'),
          icon: Images,
          // 这组在列表靠后，默认折叠时用户看不到子项，会误以为「不能下拉」
          defaultOpen: true,
          items: [
            {
              title: t('Watermark', { defaultValue: '内容标识' }),
              url: '/system-settings/watermark',
            },
            {
              title: t('SEO', { defaultValue: 'SEO 管理' }),
              url: '/system-settings/seo',
            },
            {
              title: t('Gallery presets', { defaultValue: '画廊预设' }),
              url: '/system-settings/gallery-presets',
            },
            {
              title: t('Home settings'),
              url: '/admin/home-settings',
            },
            {
              title: t('Gallery review'),
              url: '/admin/prompt-gallery',
            },
          ],
        },
      ],
    },
  ]
}

/**
 * Nested sidebar view for `/system-settings/*`.
 *
 * Activates the Vercel / Cloudflare-style drill-in sidebar:
 * the root navigation is replaced by the system administration
 * groups, with a "Back to Dashboard" affordance in the header.
 */
export const SYSTEM_SETTINGS_VIEW: SidebarView = {
  id: 'system-settings',
  // 「Fork settings」组里混了两个不在 /system-settings 下的页面
  // （/admin/home-settings、/admin/prompt-gallery）。如果只匹配前一个前缀，
  // 点这两项会跳出本视图 → 侧边栏瞬间退回根导航（用户看到的就是
  // 「点了之后侧边栏回到上一级」）。所以这里要把它们一起纳入匹配。
  pathPattern: /^\/(system-settings|admin\/home-settings|admin\/prompt-gallery)(\/|$)/,
  parent: {
    to: '/dashboard/overview',
    label: 'Back to Dashboard',
  },
  getNavGroups: getSystemSettingsNavGroups,
}
