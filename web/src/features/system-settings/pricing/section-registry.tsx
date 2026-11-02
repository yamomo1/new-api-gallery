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
import { createSectionRegistry } from '../utils/section-registry'
import type { PricingSettings } from './types'
import { PriceCalculatorSection } from './sections/calculator'
import {
  GroupsSection,
  ModelPriceSection,
  ModelRatioSection,
} from './sections/json-sections'
import { GuardSection, TopupSection } from './sections/money-sections'
import { ScalesSection } from './sections/scales'

/**
 * 「统一定价」把散落在计费与支付、模型定价、分组定价、充值档位里的
 * 价格参数聚到一处，并额外提供「幕」换算器。
 *
 * 这里**不新建同义配置**，全部读写既有 option 键 —— 所以：
 *  · 原页面照常可用，功能不变；
 *  · 两个入口改的是同一份数据，不会出现两套价格；
 *  · 保存时会先复核服务端值，避免覆盖别人刚做的修改。
 */
const PRICING_SECTIONS = [
  {
    id: 'overview',
    titleKey: 'Scale & currency',
    build: (settings: PricingSettings) => (
      <ScalesSection settings={settings} />
    ),
  },
  {
    id: 'model-ratio',
    titleKey: 'Model ratios',
    build: (settings: PricingSettings) => (
      <ModelRatioSection settings={settings} />
    ),
  },
  {
    id: 'model-price',
    titleKey: 'Per-request pricing',
    build: (settings: PricingSettings) => (
      <ModelPriceSection settings={settings} />
    ),
  },
  {
    id: 'groups',
    titleKey: 'Group ratios',
    build: (settings: PricingSettings) => <GroupsSection settings={settings} />,
  },
  {
    id: 'topup',
    titleKey: 'Top-up & grants',
    build: (settings: PricingSettings) => <TopupSection settings={settings} />,
  },
  {
    id: 'guard',
    titleKey: 'Pre-consume & display',
    build: (settings: PricingSettings) => <GuardSection settings={settings} />,
  },
  {
    id: 'calculator',
    titleKey: 'Credit calculator',
    build: (settings: PricingSettings) => (
      <PriceCalculatorSection settings={settings} />
    ),
  },
] as const

export type PricingSectionId = (typeof PRICING_SECTIONS)[number]['id']

const pricingRegistry = createSectionRegistry<PricingSectionId, PricingSettings>({
  sections: PRICING_SECTIONS,
  defaultSection: 'overview',
  basePath: '/system-settings/pricing',
  urlStyle: 'path',
})

export const PRICING_SECTION_IDS = pricingRegistry.sectionIds
export const PRICING_DEFAULT_SECTION = pricingRegistry.defaultSection
export const getPricingSectionNavItems = pricingRegistry.getSectionNavItems
export const getPricingSectionContent = pricingRegistry.getSectionContent
export const getPricingSectionMeta = pricingRegistry.getSectionMeta
