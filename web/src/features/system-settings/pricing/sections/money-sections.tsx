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
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'

import {
  checkJson,
  checkJsonObject,
  PricingJsonField,
  PricingNumberField,
  PricingReadout,
  PricingSwitchField,
  PricingTextField,
} from '../fields'
import { derivePolicy, fmtMoney, fmtPct } from '../lib'
import { PricingSectionShell } from '../shell'
import type { PricingSettings } from '../types'

const jsonObject = z.string().superRefine((value, ctx) => {
  const error = checkJsonObject(value)
  if (error) ctx.addIssue({ code: 'custom', message: error })
})

const jsonAny = z.string().superRefine((value, ctx) => {
  const error = checkJson(value)
  if (error) ctx.addIssue({ code: 'custom', message: error })
})

// ============================================================ 充值与额度
const topupSchema = z.object({
  Price: z.coerce.number().positive(),
  MinTopUp: z.coerce.number().min(0),
  amountOptions: jsonAny,
  amountDiscount: jsonObject,
  QuotaForNewUser: z.coerce.number().min(0),
  QuotaForInviter: z.coerce.number().min(0),
  QuotaForInvitee: z.coerce.number().min(0),
  TopUpLink: z.string(),
})

export function TopupSection({ settings }: { settings: PricingSettings }) {
  const { t } = useTranslation()

  return (
    <PricingSectionShell
      title='Top-up & grants'
      schema={topupSchema}
      defaults={{
        Price: settings.Price,
        MinTopUp: settings.MinTopUp,
        amountOptions: settings['payment_setting.amount_options'],
        amountDiscount: settings['payment_setting.amount_discount'],
        QuotaForNewUser: settings.QuotaForNewUser,
        QuotaForInviter: settings.QuotaForInviter,
        QuotaForInvitee: settings.QuotaForInvitee,
        TopUpLink: settings.TopUpLink,
      }}
      original={settings as unknown as Record<string, string | number | boolean>}
      saveLabel='Save top-up settings'
      toUpdates={(values) => ({
        Price: String(values.Price),
        MinTopUp: String(values.MinTopUp),
        'payment_setting.amount_options': values.amountOptions.trim(),
        'payment_setting.amount_discount': values.amountDiscount.trim(),
        QuotaForNewUser: String(values.QuotaForNewUser),
        QuotaForInviter: String(values.QuotaForInviter),
        QuotaForInvitee: String(values.QuotaForInvitee),
        TopUpLink: values.TopUpLink.trim(),
      })}
    >
      {({ control, values }) => {
        const policy = {
          muEnabled: settings['pricing_policy.mu_enabled'],
          muPerRmb: Number(settings['pricing_policy.mu_per_rmb']),
          quotaPerMu: Number(settings['pricing_policy.quota_per_mu']),
          baseMargin: Number(settings['pricing_policy.base_margin']),
          targetMargin: Number(settings['pricing_policy.target_margin']),
          quotaPerUnit: Number(settings.QuotaPerUnit),
          usdExchangeRate: Number(settings.USDExchangeRate),
        }
        const derived = derivePolicy(policy)
        const price = Number(values.Price)
        const demoAmount = 100

        // New API 的真实口径：
        //   payMoney = amount × Price        （Price = 1 美元额度卖多少元）
        //   quota    = amount × QuotaPerUnit （发额度按面额，与 Price 无关）
        // 所以「付 ¥100」等价于 amount = 100 / Price，到账 quota × amount。
        const quotaPerMu = Math.max(
          1,
          Number(settings['pricing_policy.quota_per_mu'])
        )
        const amountFor = price > 0 ? demoAmount / price : 0
        const muFor = (amountFor * Number(settings.QuotaPerUnit)) / quotaPerMu
        const perRmb = muFor / demoAmount
        const targetPerRmb = Number(settings['pricing_policy.mu_per_rmb'])
        const aligned = Math.abs(perRmb - targetPerRmb) < 0.05
        const costOfDemo = muFor * derived.costPerMu

        return (
          <>
            <PricingReadout
              items={[
                {
                  label: t('Top up ¥100 → credits'),
                  value: `${muFor.toFixed(1)} 幕`,
                  tone: aligned ? 'good' : 'warn',
                },
                {
                  label: t('Effective credits per ¥1'),
                  value: perRmb.toFixed(2),
                  tone: aligned ? 'good' : 'warn',
                },
                {
                  label: t('Credits per ¥1 in pricing scale'),
                  value: targetPerRmb.toFixed(2),
                },
                {
                  label: t('Upstream cost of that top-up'),
                  value: fmtMoney(costOfDemo),
                },
                {
                  label: t('Gross margin on that top-up'),
                  value: fmtPct(1 - costOfDemo / demoAmount),
                  tone:
                    1 - costOfDemo / demoAmount >=
                    Number(settings['pricing_policy.target_margin'])
                      ? 'good'
                      : 'warn',
                },
                {
                  label: t('Price needed to match the scale'),
                  value: derived.expectedPrice.toFixed(3),
                  tone: aligned ? 'good' : 'warn',
                },
              ]}
            />

            <div className='grid gap-5 sm:grid-cols-2'>
              <PricingNumberField
                control={control}
                name='Price'
                label='Price'
                step='0.01'
                min={0.01}
                description={t(
                  'How many CNY one USD of quota costs. When it differs from the price derived by the credit scale, customers get more or fewer credits per yuan than the scale claims — the readout above shows the gap.'
                )}
              />
              <PricingNumberField
                control={control}
                name='MinTopUp'
                label='MinTopUp'
                step='0.01'
                min={0}
                unit='CNY'
                description={t('Smallest allowed top-up amount.')}
              />
            </div>

            <div className='grid gap-5 lg:grid-cols-2'>
              <PricingJsonField
                control={control}
                name='amountOptions'
                label='payment_setting.amount_options'
                rows={3}
                description={t(
                  'Preset amounts shown on the wallet page, e.g. [10, 50, 100, 300, 500, 1000].'
                )}
              />
              <PricingJsonField
                control={control}
                name='amountDiscount'
                label='payment_setting.amount_discount'
                rows={3}
                description={t(
                  'Per-amount discount as a pay ratio: { "500": 0.9524 } means the customer pays 95.24% for a 5% bonus. Converting a bonus into a discount keeps the unit price identical.'
                )}
              />
            </div>

            <div className='grid gap-5 sm:grid-cols-3'>
              <PricingNumberField
                control={control}
                name='QuotaForNewUser'
                label='QuotaForNewUser'
                step='1'
                min={0}
                unit='quota'
                description={t('Granted once when a user registers.')}
              />
              <PricingNumberField
                control={control}
                name='QuotaForInviter'
                label='QuotaForInviter'
                step='1'
                min={0}
                unit='quota'
                description={t('Granted to the inviter on a successful invite.')}
              />
              <PricingNumberField
                control={control}
                name='QuotaForInvitee'
                label='QuotaForInvitee'
                step='1'
                min={0}
                unit='quota'
                description={t('Granted to the invited user.')}
              />
            </div>

            <PricingTextField
              control={control}
              name='TopUpLink'
              label='TopUpLink'
              placeholder='https://…'
              description={t(
                'Optional external top-up page. Leave empty to use the built-in wallet.'
              )}
            />
          </>
        )
      }}
    </PricingSectionShell>
  )
}

// ============================================================ 预扣与展示
const guardSchema = z.object({
  preConsumeMultiplier: z.coerce.number().min(0),
  trustQuotaUsd: z.coerce.number().min(0),
  freeModelPreConsume: z.boolean(),
  displayType: z.enum(['USD', 'CNY', 'TOKENS', 'CUSTOM']),
  customSymbol: z.string(),
  customRate: z.coerce.number().positive(),
  displayInCurrency: z.boolean(),
  displayTokenStat: z.boolean(),
})

const DISPLAY_TYPES = ['USD', 'CNY', 'TOKENS', 'CUSTOM'] as const

export function GuardSection({ settings }: { settings: PricingSettings }) {
  const { t } = useTranslation()

  const displayType = DISPLAY_TYPES.includes(
    settings['general_setting.quota_display_type'] as (typeof DISPLAY_TYPES)[number]
  )
    ? (settings['general_setting.quota_display_type'] as (typeof DISPLAY_TYPES)[number])
    : 'USD'

  return (
    <PricingSectionShell
      title='Pre-consume & display'
      schema={guardSchema}
      defaults={{
        preConsumeMultiplier: settings['quota_setting.pre_consume_multiplier'],
        trustQuotaUsd: settings['quota_setting.trust_quota_usd'],
        freeModelPreConsume:
          settings['quota_setting.enable_free_model_pre_consume'],
        displayType,
        customSymbol: settings['general_setting.custom_currency_symbol'],
        customRate: settings['general_setting.custom_currency_exchange_rate'],
        displayInCurrency: settings.DisplayInCurrencyEnabled,
        displayTokenStat: settings.DisplayTokenStatEnabled,
      }}
      original={settings as unknown as Record<string, string | number | boolean>}
      saveLabel='Save pre-consume settings'
      toUpdates={(values) => ({
        'quota_setting.pre_consume_multiplier': String(
          values.preConsumeMultiplier
        ),
        'quota_setting.trust_quota_usd': String(values.trustQuotaUsd),
        'quota_setting.enable_free_model_pre_consume': String(
          values.freeModelPreConsume
        ),
        'general_setting.quota_display_type': values.displayType,
        'general_setting.custom_currency_symbol': values.customSymbol,
        'general_setting.custom_currency_exchange_rate': String(
          values.customRate
        ),
        DisplayInCurrencyEnabled: String(values.displayInCurrency),
        DisplayTokenStatEnabled: String(values.displayTokenStat),
      })}
    >
      {({ control, values }) => (
        <>
          <div className='bg-muted/40 rounded-2xl px-5 py-4 text-[13px] leading-[1.75]'>
            <p className='text-muted-foreground'>
              {t(
                'A request is pre-charged before it runs and settled afterwards. The multiplier decides how much is reserved up front — too low and heavy requests can overdraw, too high and light requests look unaffordable. Video calls reserve large amounts, so keep it at or above 1.'
              )}
            </p>
          </div>

          <div className='grid gap-5 sm:grid-cols-2'>
            <PricingNumberField
              control={control}
              name='preConsumeMultiplier'
              label='quota_setting.pre_consume_multiplier'
              step='0.1'
              min={0}
              unit='×'
              description={t(
                'Multiplier applied to the estimated cost when reserving quota.'
              )}
            />
            <PricingNumberField
              control={control}
              name='trustQuotaUsd'
              label='quota_setting.trust_quota_usd'
              step='1'
              min={0}
              unit='USD'
              description={t(
                'Credit line (in USD) granted before the balance check bites.'
              )}
            />
          </div>

          <PricingSwitchField
            control={control}
            name='freeModelPreConsume'
            label={t('Pre-consume for free models')}
            description={t(
              'When disabled, models priced at zero skip the reservation step entirely.'
            )}
          />

          <div className='grid gap-5 sm:grid-cols-2'>
            <FormField
              control={control}
              name='displayType'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    general_setting.quota_display_type
                  </FormLabel>
                  <FormControl>
                    <NativeSelect
                      value={field.value}
                      onChange={(event) => field.onChange(event.target.value)}
                    >
                      <NativeSelectOption value='USD'>
                        USD
                      </NativeSelectOption>
                      <NativeSelectOption value='CNY'>
                        CNY
                      </NativeSelectOption>
                      <NativeSelectOption value='TOKENS'>
                        TOKENS
                      </NativeSelectOption>
                      <NativeSelectOption value='CUSTOM'>
                        CUSTOM
                      </NativeSelectOption>
                    </NativeSelect>
                  </FormControl>
                  <FormDescription>
                    {t(
                      'How balances and prices are presented to end users. It never changes the underlying quota.'
                    )}
                  </FormDescription>
                </FormItem>
              )}
            />
            <PricingNumberField
              control={control}
              name='customRate'
              label='general_setting.custom_currency_exchange_rate'
              step='0.01'
              min={0.01}
              description={t(
                'Only used when the display type is CUSTOM.'
              )}
            />
          </div>

          {values.displayType === 'CUSTOM' && (
            <PricingTextField
              control={control}
              name='customSymbol'
              label='general_setting.custom_currency_symbol'
              placeholder='¤'
              description={t('Symbol shown in front of the custom amount.')}
            />
          )}

          <div className='grid gap-3'>
            <PricingSwitchField
              control={control}
              name='displayInCurrency'
              label='DisplayInCurrencyEnabled'
              description={t('Show balances as an amount instead of raw quota.')}
            />
            <PricingSwitchField
              control={control}
              name='displayTokenStat'
              label='DisplayTokenStatEnabled'
              description={t('Show the token usage statistics block in the console.')}
            />
          </div>
        </>
      )}
    </PricingSectionShell>
  )
}
