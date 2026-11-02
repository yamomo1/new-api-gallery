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
 * 统一定价页读取的 option 键。
 *
 * 全部复用 New API 既有键（不新建同义配置），只有 `pricing_policy.*`
 * 是本 Fork 新增的「幕」口径参数（后端 setting/pricing_policy.go 注册）。
 * 因此这一页保存后，原「计费与支付」「模型定价」页面看到的值会同步变化。
 */
export type PricingSettings = {
  // ---- 计价刻度
  QuotaPerUnit: number
  USDExchangeRate: number
  'pricing_policy.mu_enabled': boolean
  'pricing_policy.mu_per_rmb': number
  'pricing_policy.quota_per_mu': number
  'pricing_policy.base_margin': number
  'pricing_policy.target_margin': number

  // ---- 模型倍率
  ModelRatio: string
  CompletionRatio: string
  CacheRatio: string
  CreateCacheRatio: string
  ImageRatio: string
  AudioRatio: string
  AudioCompletionRatio: string
  ExposeRatioEnabled: boolean

  // ---- 按次价格 / 表达式计费
  ModelPrice: string
  'billing_setting.billing_mode': string
  'billing_setting.billing_expr': string
  'billing_setting.plugin_billing_expr': string
  'tool_price_setting.prices': string

  // ---- 分组倍率
  GroupRatio: string
  TopupGroupRatio: string
  UserUsableGroups: string
  GroupGroupRatio: string
  AutoGroups: string
  MaxTokenAutoGroups: number
  DefaultUseAutoGroup: boolean
  'group_ratio_setting.group_special_usable_group': string

  // ---- 充值 / 额度
  Price: number
  MinTopUp: number
  'payment_setting.amount_options': string
  'payment_setting.amount_discount': string
  QuotaForNewUser: number
  QuotaForInviter: number
  QuotaForInvitee: number
  TopUpLink: string

  // ---- 预扣与展示
  'quota_setting.pre_consume_multiplier': number
  'quota_setting.trust_quota_usd': number
  'quota_setting.enable_free_model_pre_consume': boolean
  'general_setting.quota_display_type': string
  'general_setting.custom_currency_symbol': string
  'general_setting.custom_currency_exchange_rate': number
  DisplayInCurrencyEnabled: boolean
  DisplayTokenStatEnabled: boolean
}

export const PRICING_DEFAULTS: PricingSettings = {
  QuotaPerUnit: 500000,
  USDExchangeRate: 7,
  'pricing_policy.mu_enabled': true,
  'pricing_policy.mu_per_rmb': 10,
  'pricing_policy.quota_per_mu': 5136,
  'pricing_policy.base_margin': 0.25,
  'pricing_policy.target_margin': 0.2,

  ModelRatio: '',
  CompletionRatio: '',
  CacheRatio: '',
  CreateCacheRatio: '',
  ImageRatio: '',
  AudioRatio: '',
  AudioCompletionRatio: '',
  ExposeRatioEnabled: false,

  ModelPrice: '',
  'billing_setting.billing_mode': '{}',
  'billing_setting.billing_expr': '{}',
  'billing_setting.plugin_billing_expr': '{}',
  'tool_price_setting.prices': '{}',

  GroupRatio: '',
  TopupGroupRatio: '',
  UserUsableGroups: '',
  GroupGroupRatio: '',
  AutoGroups: '',
  MaxTokenAutoGroups: 5,
  DefaultUseAutoGroup: false,
  'group_ratio_setting.group_special_usable_group': '{}',

  Price: 7.3,
  MinTopUp: 1,
  'payment_setting.amount_options': '',
  'payment_setting.amount_discount': '',
  QuotaForNewUser: 0,
  QuotaForInviter: 0,
  QuotaForInvitee: 0,
  TopUpLink: '',

  'quota_setting.pre_consume_multiplier': 1,
  'quota_setting.trust_quota_usd': 10,
  'quota_setting.enable_free_model_pre_consume': true,
  'general_setting.quota_display_type': 'USD',
  'general_setting.custom_currency_symbol': '¤',
  'general_setting.custom_currency_exchange_rate': 1,
  DisplayInCurrencyEnabled: true,
  DisplayTokenStatEnabled: true,
}
