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
 * ------------------------------------------------------------------
 * 字段分两类：
 * - `TEXT_GROUPS`：文案，按语种各存一份（locales[lang]）
 * - `SHARED_GROUPS`：视频、链接、图片路径、开关、时长——跨语种共用一份
 *   （shared），改一次所有语种都生效
 * 分组名与字段名都写英文原文，渲染时过一遍 t()，见 home-settings/index.tsx。
 */

export type FieldType = 'text' | 'textarea' | 'list' | 'number' | 'switch'

export type Field = { path: string; label: string; type?: FieldType }

export type FieldGroup = { key: string; title: string; fields: Field[] }

/** 文案分组：按语种编辑 */
export const TEXT_GROUPS: FieldGroup[] = [
  {
    key: 'hero',
    title: 'Hero screen',
    fields: [
      { path: 'hero.badge', label: 'Badge text' },
      { path: 'hero.announcement', label: 'Announcement bar', type: 'textarea' },
      { path: 'hero.title', label: 'Headline (use \\n for a line break)', type: 'textarea' },
      { path: 'hero.titleAccent', label: 'Gold accent line' },
      { path: 'hero.subtitle', label: 'Subhead', type: 'textarea' },
      { path: 'hero.primaryLabel', label: 'Primary button label' },
      { path: 'hero.secondaryLabel', label: 'Secondary button label' },
      { path: 'hero.metaLabels', label: 'Perk phrases (comma separated)', type: 'list' },
      { path: 'hero.card.tag', label: 'Hero card tag' },
      { path: 'hero.card.title', label: 'Hero card title' },
    ],
  },
  {
    key: 'agent',
    title: 'Canvas Agent section',
    fields: [
      { path: 'agent.eyebrow', label: 'Section eyebrow' },
      { path: 'agent.titleLine1', label: 'Headline line 1' },
      { path: 'agent.titleLine2', label: 'Headline line 2 (muted)' },
      { path: 'agent.lead', label: 'Right column lead', type: 'textarea' },
      { path: 'agent.placeholder', label: 'Composer placeholder', type: 'textarea' },
      { path: 'agent.attachLabel', label: 'Attach button label' },
      { path: 'agent.autoLabel', label: 'Auto mode label' },
      { path: 'agent.skillsMenuTitle', label: 'Skills menu title' },
      { path: 'agent.helperLabel', label: 'Approval hint' },
      { path: 'agent.sendLabel', label: 'Send button label' },
      { path: 'agent.skills.0.label', label: 'Skill 1 name' },
      { path: 'agent.skills.1.label', label: 'Skill 2 name' },
      { path: 'agent.skills.2.label', label: 'Skill 3 name' },
      { path: 'agent.skills.3.label', label: 'Skill 4 name' },
      { path: 'agent.skills.4.label', label: 'Skill 5 name' },
      { path: 'agent.skills.5.label', label: 'Skill 6 name' },
      { path: 'agent.features.0.title', label: 'Feature 1 title' },
      { path: 'agent.features.0.desc', label: 'Feature 1 description', type: 'textarea' },
      { path: 'agent.features.1.title', label: 'Feature 2 title' },
      { path: 'agent.features.1.desc', label: 'Feature 2 description', type: 'textarea' },
      { path: 'agent.features.2.title', label: 'Feature 3 title' },
      { path: 'agent.features.2.desc', label: 'Feature 3 description', type: 'textarea' },
      { path: 'agent.features.3.title', label: 'Feature 4 title' },
      { path: 'agent.features.3.desc', label: 'Feature 4 description', type: 'textarea' },
      { path: 'agent.preview.bubble', label: 'Preview prompt bubble', type: 'textarea' },
      { path: 'agent.preview.badge', label: 'Preview badge' },
      { path: 'agent.preview.editLabel', label: 'Edit plan button label' },
      { path: 'agent.preview.runLabel', label: 'Approve and run button label' },
    ],
  },
  {
    key: 'studios',
    title: 'Studios section',
    fields: [
      { path: 'studios.eyebrow', label: 'Section eyebrow' },
      { path: 'studios.title', label: 'Headline' },
      { path: 'studios.lead', label: 'Lead', type: 'textarea' },
    ],
  },
  {
    key: 'gallery',
    title: 'Inspiration gallery section',
    fields: [
      { path: 'gallery.eyebrow', label: 'Section eyebrow' },
      { path: 'gallery.title', label: 'Headline' },
      { path: 'gallery.lead', label: 'Lead', type: 'textarea' },
      { path: 'gallery.tabs', label: 'Filter tabs (comma separated)', type: 'list' },
      { path: 'gallery.exploreLabel', label: 'Browse button label' },
      { path: 'gallery.featuredTitle', label: 'Featured title' },
    ],
  },
  {
    key: 'models',
    title: 'Model highlights section',
    fields: [
      { path: 'models.eyebrow', label: 'Section eyebrow' },
      { path: 'models.title', label: 'Headline' },
      { path: 'models.lead', label: 'Lead', type: 'textarea' },
      { path: 'models.exploreLabel', label: 'Browse button label' },
    ],
  },
  {
    key: 'cta',
    title: 'API section',
    fields: [
      { path: 'cta.eyebrow', label: 'Section eyebrow' },
      { path: 'cta.title', label: 'Headline' },
      { path: 'cta.lead', label: 'Lead', type: 'textarea' },
      { path: 'cta.features', label: 'Feature titles (comma separated)', type: 'list' },
      { path: 'cta.featureDescs', label: 'Feature descriptions (comma separated)', type: 'list' },
      { path: 'cta.codeTitle', label: 'Code panel title' },
      { path: 'cta.genLabel', label: 'Primary button label' },
      { path: 'cta.docsLabel', label: 'Secondary button label' },
      { path: 'cta.connectKicker', label: 'Connect card kicker' },
      { path: 'cta.connectTitle', label: 'Connect card title', type: 'textarea' },
      { path: 'cta.connectPoints', label: 'Connect card points (comma separated)', type: 'list' },
      { path: 'cta.connectPrimaryLabel', label: 'Connect card primary label' },
      { path: 'cta.connectSecondaryLabel', label: 'Connect card secondary label' },
    ],
  },
  {
    key: 'closing',
    title: 'Closing call to action',
    fields: [
      { path: 'closing.kicker', label: 'Kicker' },
      { path: 'closing.title', label: 'Headline' },
      { path: 'closing.lead', label: 'Lead', type: 'textarea' },
      { path: 'closing.primaryLabel', label: 'Primary button label' },
      { path: 'closing.secondaryLabel', label: 'Secondary button label' },
    ],
  },
  {
    key: 'ticker',
    title: 'Top ticker',
    fields: [{ path: 'motion.heroTicker.prefix', label: 'Ticker prefix' }],
  },
]

/** 共享分组：不分语种，改一次全站生效 */
export const SHARED_GROUPS: FieldGroup[] = [
  {
    key: 'links',
    title: 'Buttons and links',
    fields: [
      { path: 'hero.primaryUrl', label: 'Primary button link' },
      { path: 'hero.secondaryUrl', label: 'Secondary button link (empty hides it)' },
      { path: 'cta.connectUrl', label: 'API button link' },
      { path: 'closing.primaryUrl', label: 'Closing primary link' },
      { path: 'closing.secondaryUrl', label: 'Closing secondary link' },
      { path: 'cta.apiBase', label: 'API base URL (shown in the code window)' },
      { path: 'cta.connectSecondaryUrl', label: 'Connect card secondary link' },
    ],
  },
  {
    key: 'media',
    title: 'Media paths',
    fields: [
      { path: 'hero.card.images', label: 'Hero card images (comma separated)', type: 'list' },
      { path: 'gallery.featuredVideo', label: 'Featured video path' },
      { path: 'closing.art', label: 'Closing background image' },
    ],
  },
  {
    key: 'motion',
    title: 'Ticker and video',
    fields: [
      { path: 'motion.ticker', label: 'Model names (comma separated)', type: 'list' },
      { path: 'motion.heroTicker.enabled', label: 'Show top ticker', type: 'switch' },
      { path: 'motion.heroTicker.durationSec', label: 'Scroll duration (seconds)', type: 'number' },
      { path: 'motion.heroVideo.enabled', label: 'Show hero video', type: 'switch' },
      { path: 'motion.heroVideo.mask', label: 'Video dim level (0 to 1)', type: 'number' },
    ],
  },
]

/** 全部分组（供译文覆盖率测试遍历） */
export const FIELD_GROUPS: FieldGroup[] = [...TEXT_GROUPS, ...SHARED_GROUPS]

/** 文案字段的路径全集（用于按语种的「已填/总数」统计与批量操作） */
export const TEXT_FIELD_PATHS: string[] = TEXT_GROUPS.flatMap((g) =>
  g.fields.map((f) => f.path),
)

export const TOTAL_TEXT_FIELDS = TEXT_FIELD_PATHS.length
