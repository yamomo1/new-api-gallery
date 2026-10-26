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

/**
 * 首页设置表单结构（英文 label 即 i18n key，见 i18n-coverage 测试）
 */

export type Field = { path: string; label: string; type?: 'text' | 'textarea' | 'list' }

export const FIELD_GROUPS: { key: string; title: string; fields: Field[] }[] = [
  {
    key: 'hero',
    title: 'Hero screen',
    fields: [
      { path: 'hero.badge', label: 'Badge text' },
      { path: 'hero.announcement', label: 'Announcement bar' },
      { path: 'hero.title', label: 'Headline (use \\n for a line break)', type: 'textarea' },
      { path: 'hero.titleAccent', label: 'Gold accent line' },
      { path: 'hero.subtitle', label: 'Subhead', type: 'textarea' },
      { path: 'hero.primaryLabel', label: 'Primary button label' },
      { path: 'hero.primaryUrl', label: 'Primary button link' },
      { path: 'hero.secondaryLabel', label: 'Secondary button label' },
      { path: 'hero.secondaryUrl', label: 'Secondary button link (empty hides it)' },
      { path: 'hero.metaLabels', label: 'Perk phrases (comma separated)', type: 'list' },
    ],
  },
  {
    key: 'agent',
    title: 'Canvas Agent section',
    fields: [
      { path: 'agent.titleLine1', label: 'Headline line 1' },
      { path: 'agent.titleLine2', label: 'Headline line 2 (muted)' },
      { path: 'agent.lead', label: 'Right column lead', type: 'textarea' },
      { path: 'agent.placeholder', label: 'Composer placeholder', type: 'textarea' },
      { path: 'agent.autoLabel', label: 'Auto mode label' },
      { path: 'agent.skillsMenuTitle', label: 'Skills menu title' },
      { path: 'agent.helperLabel', label: 'Approval hint' },
      { path: 'agent.skills.0.label', label: 'Skill 1 name' },
      { path: 'agent.skills.1.label', label: 'Skill 2 name' },
      { path: 'agent.skills.2.label', label: 'Skill 3 name' },
      { path: 'agent.skills.3.label', label: 'Skill 4 name' },
      { path: 'agent.skills.4.label', label: 'Skill 5 name' },
      { path: 'agent.skills.5.label', label: 'Skill 6 name' },
    ],
  },
  {
    key: 'studios',
    title: 'Studios section',
    fields: [
      { path: 'studios.title', label: 'Headline' },
      { path: 'studios.lead', label: 'Lead', type: 'textarea' },
    ],
  },
  {
    key: 'gallery',
    title: 'Inspiration gallery section',
    fields: [
      { path: 'gallery.title', label: 'Headline' },
      { path: 'gallery.lead', label: 'Lead', type: 'textarea' },
      { path: 'gallery.exploreLabel', label: 'Browse button label' },
    ],
  },
  {
    key: 'models',
    title: 'Model highlights section',
    fields: [
      { path: 'models.title', label: 'Headline' },
      { path: 'models.lead', label: 'Lead', type: 'textarea' },
      { path: 'models.exploreLabel', label: 'Browse button label' },
    ],
  },
  {
    key: 'cta',
    title: 'API section',
    fields: [
      { path: 'cta.title', label: 'Headline' },
      { path: 'cta.lead', label: 'Lead', type: 'textarea' },
      { path: 'cta.connectLabel', label: 'Button label' },
    ],
  },
  {
    key: 'closing',
    title: 'Closing call to action',
    fields: [
      { path: 'closing.title', label: 'Headline' },
      { path: 'closing.lead', label: 'Lead', type: 'textarea' },
      { path: 'closing.primaryLabel', label: 'Primary button label' },
      { path: 'closing.primaryUrl', label: 'Primary button link' },
      { path: 'closing.secondaryLabel', label: 'Secondary button label' },
      { path: 'closing.secondaryUrl', label: 'Secondary button link' },
    ],
  },
]
