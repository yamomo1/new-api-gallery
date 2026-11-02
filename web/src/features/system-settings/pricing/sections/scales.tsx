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

import { derivePolicy, fmtMoney, fmtPct } from '../lib'
import {
  PricingNumberField,
  PricingReadout,
  PricingSwitchField,
} from '../fields'
import { PricingSectionShell } from '../shell'
import type { PricingSettings } from '../types'

const schema = z.object({
  QuotaPerUnit: z.coerce.number().positive(),
  USDExchangeRate: z.coerce.number().positive(),
  muEnabled: z.boolean(),
  muPerRmb: z.coerce.number().positive(),
  quotaPerMu: z.coerce.number().int().positive(),
  baseMargin: z.coerce.number().min(0).max(0.99),
  targetMargin: z.coerce.number().min(0).max(0.99),
})

type Values = z.infer<typeof schema>

export function ScalesSection({ settings }: { settings: PricingSettings }) {
  const { t } = useTranslation()

  const defaults: Values = {
    QuotaPerUnit: settings.QuotaPerUnit,
    USDExchangeRate: settings.USDExchangeRate,
    muEnabled: settings['pricing_policy.mu_enabled'],
    muPerRmb: settings['pricing_policy.mu_per_rmb'],
    quotaPerMu: settings['pricing_policy.quota_per_mu'],
    baseMargin: settings['pricing_policy.base_margin'],
    targetMargin: settings['pricing_policy.target_margin'],
  }

  return (
    <PricingSectionShell
      title='Pricing scale & currency'
      schema={schema}
      defaults={defaults}
      original={settings as unknown as Record<string, string | number | boolean>}
      saveLabel='Save pricing scale'
      toUpdates={(values) => ({
        QuotaPerUnit: String(values.QuotaPerUnit),
        USDExchangeRate: String(values.USDExchangeRate),
        'pricing_policy.mu_enabled': String(values.muEnabled),
        'pricing_policy.mu_per_rmb': String(values.muPerRmb),
        'pricing_policy.quota_per_mu': String(values.quotaPerMu),
        'pricing_policy.base_margin': String(values.baseMargin),
        'pricing_policy.target_margin': String(values.targetMargin),
      })}
    >
      {({ control, values }) => {
        const derived = derivePolicy({
          muEnabled: values.muEnabled,
          muPerRmb: Number(values.muPerRmb),
          quotaPerMu: Number(values.quotaPerMu),
          baseMargin: Number(values.baseMargin),
          targetMargin: Number(values.targetMargin),
          quotaPerUnit: Number(values.QuotaPerUnit),
          usdExchangeRate: Number(values.USDExchangeRate),
        })
        const marginTone =
          derived.margin >= Number(values.targetMargin)
            ? ('good' as const)
            : ('warn' as const)

        return (
          <>
            <PricingReadout
              items={[
                { label: t('Price per credit'), value: fmtMoney(derived.muPrice) },
                {
                  label: t('Credits per ¥1'),
                  value: `${values.muPerRmb} = ${derived.quotaPerRmb.toLocaleString()} quota`,
                },
                {
                  label: t('Upstream cost per credit'),
                  value: fmtMoney(derived.costPerMu, 4),
                },
                {
                  label: t('Effective margin'),
                  value: fmtPct(derived.margin),
                  tone: marginTone,
                },
                {
                  label: 'K (credits / USD)',
                  value: derived.muPerUsd.toLocaleString('zh-CN', {
                    maximumFractionDigits: 2,
                  }),
                },
                {
                  label: t('Price needed for target'),
                  value: derived.expectedPrice.toFixed(3),
                  tone: 'warn',
                },
              ]}
            />

            <div className='grid gap-5 sm:grid-cols-2'>
              <PricingNumberField
                control={control}
                name='QuotaPerUnit'
                label='QuotaPerUnit'
                description={t(
                  'How many internal quota one USD is worth. Do not change it casually — every existing balance is denominated in quota.'
                )}
                unit='quota'
                step='1'
                min={1}
              />
              <PricingNumberField
                control={control}
                name='USDExchangeRate'
                label='USDExchangeRate'
                description={t(
                  'USD → CNY rate used to convert upstream USD cost into RMB. Also the anchor of the credit margin.'
                )}
                unit='CNY'
                step='0.01'
                min={0.01}
              />
            </div>

            <PricingSwitchField
              control={control}
              name='muEnabled'
              label={t('Show prices in credits (幕)')}
              description={t(
                'Display-only switch. Turning it off does not change how quota is deducted — the raw quota numbers stay the same.'
              )}
            />

            <div className='grid gap-5 sm:grid-cols-2'>
              <PricingNumberField
                control={control}
                name='muPerRmb'
                label={t('Credits per ¥1')}
                description={t(
                  'Selling scale. 10 means 1 credit = ¥0.10. Changing it changes the price of everything at once.'
                )}
                unit='幕'
                step='1'
                min={1}
              />
              <PricingNumberField
                control={control}
                name='quotaPerMu'
                label={t('Quota per credit')}
                description={t(
                  'Engineering constant. Must be floor(QuotaPerUnit / K). Rounding it up eats the margin.'
                )}
                unit='quota'
                step='1'
                min={1}
              />
            </div>

            <div className='grid gap-5 sm:grid-cols-2'>
              <PricingNumberField
                control={control}
                name='baseMargin'
                label={t('Base margin (pricing)')}
                description={t(
                  'Target margin for a single SKU. 0.25 = 25%. It should stay above the acceptance line because giveaways, channel fees and refunds all come out of this buffer.'
                )}
                step='0.01'
                min={0}
                max={0.99}
              />
              <PricingNumberField
                control={control}
                name='targetMargin'
                label={t('Acceptance margin (blended)')}
                description={t(
                  'The blended margin floor after giveaways, channel fees, refunds and membership discounts. Below this, prices must be raised.'
                )}
                step='0.01'
                min={0}
                max={0.99}
              />
            </div>
          </>
        )
      }}
    </PricingSectionShell>
  )
}
