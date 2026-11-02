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
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import {
  checkJsonObject,
  PricingJsonField,
  PricingNumberField,
  PricingSwitchField,
} from '../fields'
import { countEntries } from '../lib'
import { PricingSectionShell } from '../shell'
import type { PricingSettings } from '../types'

/** 允许空串，但非空时必须是合法 JSON 对象 */
const jsonObject = z.string().superRefine((value, ctx) => {
  const error = checkJsonObject(value)
  if (error) {
    ctx.addIssue({ code: 'custom', message: error })
  }
})

const entriesHint = (value: string) => {
  const count = countEntries(value)
  if (count === null) return 'invalid JSON'
  if (count === 0) return '0 entries'
  return `${count} entries`
}

// ============================================================ 模型倍率
const ratioSchema = z.object({
  ModelRatio: jsonObject,
  CompletionRatio: jsonObject,
  CacheRatio: jsonObject,
  CreateCacheRatio: jsonObject,
  ImageRatio: jsonObject,
  AudioRatio: jsonObject,
  AudioCompletionRatio: jsonObject,
  ExposeRatioEnabled: z.boolean(),
})

export function ModelRatioSection({ settings }: { settings: PricingSettings }) {
  const { t } = useTranslation()

  return (
    <PricingSectionShell
      title='Model ratios'
      schema={ratioSchema}
      defaults={{
        ModelRatio: settings.ModelRatio,
        CompletionRatio: settings.CompletionRatio,
        CacheRatio: settings.CacheRatio,
        CreateCacheRatio: settings.CreateCacheRatio,
        ImageRatio: settings.ImageRatio,
        AudioRatio: settings.AudioRatio,
        AudioCompletionRatio: settings.AudioCompletionRatio,
        ExposeRatioEnabled: settings.ExposeRatioEnabled,
      }}
      original={settings as unknown as Record<string, string | number | boolean>}
      saveLabel='Save model ratios'
      toUpdates={(values) => ({
        ModelRatio: values.ModelRatio.trim(),
        CompletionRatio: values.CompletionRatio.trim(),
        CacheRatio: values.CacheRatio.trim(),
        CreateCacheRatio: values.CreateCacheRatio.trim(),
        ImageRatio: values.ImageRatio.trim(),
        AudioRatio: values.AudioRatio.trim(),
        AudioCompletionRatio: values.AudioCompletionRatio.trim(),
        ExposeRatioEnabled: String(values.ExposeRatioEnabled),
      })}
    >
      {({ control, values }) => (
        <>
          <div className='bg-muted/40 rounded-2xl px-5 py-4 text-[13px] leading-[1.75]'>
            <p className='text-foreground font-medium'>
              {t('How a token-priced call is charged')}
            </p>
            <p className='text-muted-foreground mt-1 font-mono text-[12.5px]'>
              quota = prompt_tokens × ModelRatio + completion_tokens ×
              ModelRatio × CompletionRatio
            </p>
            <p className='text-muted-foreground mt-2'>
              {t(
                'ModelRatio uses the upstream input price in USD per 1M tokens divided by 2 — ratio 1 spends 1 quota per token, and 1 USD equals QuotaPerUnit quota. Put the real upstream price here; the platform markup belongs to the credit scale, not to the ratio.'
              )}
            </p>
          </div>

          <div className='grid gap-5 lg:grid-cols-2'>
            <PricingJsonField
              control={control}
              name='ModelRatio'
              label='ModelRatio'
              hint={entriesHint(values.ModelRatio)}
              description={t(
                'Per-model input multiplier. Formula: upstream input price (USD / 1M tokens) ÷ 2.'
              )}
            />
            <PricingJsonField
              control={control}
              name='CompletionRatio'
              label='CompletionRatio'
              hint={entriesHint(values.CompletionRatio)}
              description={t(
                'Output multiplier relative to input. 4 means output tokens cost 4× input tokens.'
              )}
            />
            <PricingJsonField
              control={control}
              name='CacheRatio'
              label='CacheRatio'
              hint={entriesHint(values.CacheRatio)}
              description={t('Multiplier applied to cached input tokens.')}
            />
            <PricingJsonField
              control={control}
              name='CreateCacheRatio'
              label='CreateCacheRatio'
              hint={entriesHint(values.CreateCacheRatio)}
              description={t('Multiplier applied when writing a cache entry.')}
            />
            <PricingJsonField
              control={control}
              name='ImageRatio'
              label='ImageRatio'
              hint={entriesHint(values.ImageRatio)}
              description={t(
                'Extra multiplier for image input tokens (vision models).'
              )}
            />
            <PricingJsonField
              control={control}
              name='AudioRatio'
              label='AudioRatio'
              hint={entriesHint(values.AudioRatio)}
              description={t('Multiplier for audio input tokens.')}
            />
            <PricingJsonField
              control={control}
              name='AudioCompletionRatio'
              label='AudioCompletionRatio'
              hint={entriesHint(values.AudioCompletionRatio)}
              description={t('Multiplier for audio output tokens.')}
            />
            <div className='flex items-end'>
              <div className='w-full'>
                <PricingSwitchField
                  control={control}
                  name='ExposeRatioEnabled'
                  label={t('Expose ratios to users')}
                  description={t(
                    'When enabled, the pricing page shows the multiplier breakdown. Disable it if you do not want the upstream cost structure to be public.'
                  )}
                />
              </div>
            </div>
          </div>
        </>
      )}
    </PricingSectionShell>
  )
}

// ============================================================ 按次价格与表达式
const priceSchema = z.object({
  ModelPrice: jsonObject,
  billingMode: jsonObject,
  billingExpr: jsonObject,
  pluginBillingExpr: jsonObject,
  toolPrices: jsonObject,
})

export function ModelPriceSection({ settings }: { settings: PricingSettings }) {
  const { t } = useTranslation()

  return (
    <PricingSectionShell
      title='Per-request price & expressions'
      schema={priceSchema}
      defaults={{
        ModelPrice: settings.ModelPrice,
        billingMode: settings['billing_setting.billing_mode'],
        billingExpr: settings['billing_setting.billing_expr'],
        pluginBillingExpr: settings['billing_setting.plugin_billing_expr'],
        toolPrices: settings['tool_price_setting.prices'],
      }}
      original={settings as unknown as Record<string, string | number | boolean>}
      saveLabel='Save per-request prices'
      toUpdates={(values) => ({
        ModelPrice: values.ModelPrice.trim(),
        'billing_setting.billing_mode': values.billingMode.trim(),
        'billing_setting.billing_expr': values.billingExpr.trim(),
        'billing_setting.plugin_billing_expr': values.pluginBillingExpr.trim(),
        'tool_price_setting.prices': values.toolPrices.trim(),
      })}
    >
      {({ control, values }) => (
        <>
          <div className='bg-muted/40 rounded-2xl px-5 py-4 text-[13px] leading-[1.75]'>
            <p className='text-foreground font-medium'>
              {t('Fixed price per request')}
            </p>
            <p className='text-muted-foreground mt-1'>
              {t(
                'ModelPrice is charged per request instead of per token. The unit is USD per call, so a ¥3.36 upstream cost becomes 0.4603. Size and duration cannot be read from the request body — split them into separate model names (ymm-img-m-2k, ymm-vid-25-720p-5s) instead of trying to price them dynamically.'
              )}
            </p>
            <p className='text-muted-foreground mt-2 font-mono text-[12.5px]'>
              ModelPrice = upstream cost (CNY) ÷ USDExchangeRate
            </p>
          </div>

          <div className='grid gap-5'>
            <PricingJsonField
              control={control}
              name='ModelPrice'
              label='ModelPrice'
              rows={8}
              hint={entriesHint(values.ModelPrice)}
              description={t(
                'Per-call price in USD. Higher tiers of the same model must be registered as separate models.'
              )}
            />
            <div className='grid gap-5 lg:grid-cols-2'>
              <PricingJsonField
                control={control}
                name='billingExpr'
                label='billing_setting.billing_expr'
                hint={entriesHint(values.billingExpr)}
                description={t(
                  'Expression-based billing per model. Leave empty when using ratios.'
                )}
              />
              <PricingJsonField
                control={control}
                name='pluginBillingExpr'
                label='billing_setting.plugin_billing_expr'
                hint={entriesHint(values.pluginBillingExpr)}
                description={t('Expression billing for plugin-provided models.')}
              />
            </div>
            <PricingJsonField
              control={control}
              name='billingMode'
              label='billing_setting.billing_mode'
              rows={4}
              hint={entriesHint(values.billingMode)}
              description={t(
                'Selects ratio / per-request / expression for each model. Shared with the Model Pricing page — editing it here has the same effect.'
              )}
            />
            <PricingJsonField
              control={control}
              name='toolPrices'
              label='tool_price_setting.prices'
              rows={4}
              hint={entriesHint(values.toolPrices)}
              description={t(
                'Prices for built-in tools (web search, file parsing and similar).'
              )}
            />
          </div>
        </>
      )}
    </PricingSectionShell>
  )
}

// ============================================================ 分组倍率
const groupSchema = z.object({
  GroupRatio: jsonObject,
  TopupGroupRatio: jsonObject,
  UserUsableGroups: jsonObject,
  GroupGroupRatio: jsonObject,
  AutoGroups: z.string(),
  MaxTokenAutoGroups: z.coerce.number().int().min(0),
  DefaultUseAutoGroup: z.boolean(),
  groupSpecial: jsonObject,
})

export function GroupsSection({ settings }: { settings: PricingSettings }) {
  const { t } = useTranslation()

  return (
    <PricingSectionShell
      title='Groups & multipliers'
      schema={groupSchema}
      defaults={{
        GroupRatio: settings.GroupRatio,
        TopupGroupRatio: settings.TopupGroupRatio,
        UserUsableGroups: settings.UserUsableGroups,
        GroupGroupRatio: settings.GroupGroupRatio,
        AutoGroups: settings.AutoGroups,
        MaxTokenAutoGroups: settings.MaxTokenAutoGroups,
        DefaultUseAutoGroup: settings.DefaultUseAutoGroup,
        groupSpecial: settings['group_ratio_setting.group_special_usable_group'],
      }}
      original={settings as unknown as Record<string, string | number | boolean>}
      saveLabel='Save group multipliers'
      toUpdates={(values) => ({
        GroupRatio: values.GroupRatio.trim(),
        TopupGroupRatio: values.TopupGroupRatio.trim(),
        UserUsableGroups: values.UserUsableGroups.trim(),
        GroupGroupRatio: values.GroupGroupRatio.trim(),
        AutoGroups: values.AutoGroups.trim(),
        MaxTokenAutoGroups: String(values.MaxTokenAutoGroups),
        DefaultUseAutoGroup: String(values.DefaultUseAutoGroup),
        'group_ratio_setting.group_special_usable_group':
          values.groupSpecial.trim(),
      })}
    >
      {({ control, values }) => (
        <>
          <div className='bg-muted/40 rounded-2xl px-5 py-4 text-[13px] leading-[1.75]'>
            <p className='text-muted-foreground'>
              {t(
                'Final charge = base price × GroupRatio. Membership discount is usually expressed as a member-only group ratio (0.89 = 8.9 折). Keep it above the discount floor, otherwise the membership margin falls below target.'
              )}
            </p>
          </div>

          <div className='grid gap-5 lg:grid-cols-2'>
            <PricingJsonField
              control={control}
              name='GroupRatio'
              label='GroupRatio'
              hint={entriesHint(values.GroupRatio)}
              description={t(
                'Per-group multiplier applied to every call. 0.89 means the group pays 89%.'
              )}
            />
            <PricingJsonField
              control={control}
              name='TopupGroupRatio'
              label='TopupGroupRatio'
              hint={entriesHint(values.TopupGroupRatio)}
              description={t(
                'Multiplier applied when converting a top-up into quota for the group.'
              )}
            />
            <PricingJsonField
              control={control}
              name='UserUsableGroups'
              label='UserUsableGroups'
              hint={entriesHint(values.UserUsableGroups)}
              description={t(
                'Groups a user can pick from, with the display name as the value.'
              )}
            />
            <PricingJsonField
              control={control}
              name='GroupGroupRatio'
              label='GroupGroupRatio'
              hint={entriesHint(values.GroupGroupRatio)}
              description={t('Cross-group multiplier overrides.')}
            />
            <PricingJsonField
              control={control}
              name='groupSpecial'
              label='group_ratio_setting.group_special_usable_group'
              hint={entriesHint(values.groupSpecial)}
              description={t(
                'Special usable-group overrides, keyed by group name.'
              )}
            />
            <div className='grid content-start gap-5'>
              <PricingJsonField
                control={control}
                name='AutoGroups'
                label='AutoGroups'
                rows={3}
                hint={`${values.AutoGroups.split(',').filter(Boolean).length} listed`}
                description={t(
                  'Comma-separated fallback order for automatic group routing.'
                )}
              />
              <PricingNumberField
                control={control}
                name='MaxTokenAutoGroups'
                label='MaxTokenAutoGroups'
                step='1'
                min={0}
                description={t(
                  'How many groups a single token may auto-route through.'
                )}
              />
            </div>
          </div>

          <PricingSwitchField
            control={control}
            name='DefaultUseAutoGroup'
            label={t('Use automatic groups by default')}
            description={t(
              'New tokens start with automatic group selection instead of a fixed group.'
            )}
          />
        </>
      )}
    </PricingSectionShell>
  )
}
