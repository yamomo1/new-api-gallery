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
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Input } from '@/components/ui/input'

import { SettingsSection } from '../../components/settings-section'
import { derivePolicy, fmtMoney, fmtPct, muFromCost, niceMu } from '../lib'
import type { PricingSettings } from '../types'

/**
 * 幕换算器：把「上游成本 → 幕 → 实付 → 毛利」这条链一次性算给运营看。
 * 只读，不写任何配置 —— 目的是让人在改价前先验算，而不是改完再看结果。
 */
export function PriceCalculatorSection({
  settings,
}: {
  settings: PricingSettings
}) {
  const { t } = useTranslation()
  const [costInput, setCostInput] = useState('3.36')
  const [muInput, setMuInput] = useState('45')

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

  const cost = Number(costInput)
  const rawMu = muFromCost(cost, derived)
  const chargedMu = niceMu(rawMu)
  const revenue = chargedMu * derived.muPrice
  const margin = revenue > 0 ? 1 - cost / revenue : 0

  const mu = Number(muInput)
  const muRevenue = mu * derived.muPrice

  const presets = [0.073, 0.35, 0.7, 3.36, 7.56, 18.71, 44.71]

  return (
    <SettingsSection title={t('Credit calculator')}>
      <div className='grid gap-6 lg:grid-cols-2'>
        {/* 正向：成本 → 幕 */}
        <div className='bg-card rounded-2xl border px-6 py-5'>
          <h4 className='text-[15px] font-semibold'>
            {t('Upstream cost → credits to charge')}
          </h4>
          <p className='text-muted-foreground mt-1 text-[12.5px]'>
            {t('Enter the real cost of one call (in CNY).')}
          </p>

          <div className='mt-4'>
            <label className='text-muted-foreground text-xs'>
              {t('Upstream cost per call')}
            </label>
            <div className='relative mt-1.5'>
              <Input
                type='number'
                step='0.01'
                value={costInput}
                onChange={(event) => setCostInput(event.target.value)}
                className='pr-8'
              />
              <span className='text-muted-foreground pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs'>
                CNY
              </span>
            </div>
          </div>

          <dl className='mt-5 space-y-2.5 text-[13px]'>
            <Row label={t('Raw credits')} value={rawMu.toFixed(2)} />
            <Row
              label={t('Rounded credits (to charge)')}
              value={`${chargedMu.toFixed(1)} 幕`}
              strong
            />
            <Row label={t('Customer pays')} value={fmtMoney(revenue)} strong />
            <Row
              label={t('Margin at this price')}
              value={fmtPct(margin)}
              tone={
                margin >= policy.targetMargin
                  ? 'good'
                  : margin > 0
                    ? 'warn'
                    : 'bad'
              }
            />
            <Row
              label={t('Cost coverage')}
              value={fmtPct(cost / Math.max(revenue, 1e-9))}
            />
          </dl>
        </div>

        {/* 反向：幕 → 成本上限 */}
        <div className='bg-card rounded-2xl border px-6 py-5'>
          <h4 className='text-[15px] font-semibold'>
            {t('Credits → cost ceiling')}
          </h4>
          <p className='text-muted-foreground mt-1 text-[12.5px]'>
            {t(
              'Given a credit price, how much upstream cost can it absorb before the margin breaks.'
            )}
          </p>

          <div className='mt-4'>
            <label className='text-muted-foreground text-xs'>
              {t('Credits charged')}
            </label>
            <div className='relative mt-1.5'>
              <Input
                type='number'
                step='0.5'
                value={muInput}
                onChange={(event) => setMuInput(event.target.value)}
                className='pr-8'
              />
              <span className='text-muted-foreground pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs'>
                幕
              </span>
            </div>
          </div>

          <dl className='mt-5 space-y-2.5 text-[13px]'>
            <Row label={t('Revenue')} value={fmtMoney(muRevenue)} strong />
            <Row
              label={t('Max cost for base margin')}
              value={fmtMoney(muRevenue * (1 - policy.baseMargin))}
            />
            <Row
              label={t('Max cost for acceptance margin')}
              value={fmtMoney(muRevenue * (1 - policy.targetMargin))}
            />
            <Row
              label={t('Break-even cost')}
              value={fmtMoney(muRevenue)}
              tone='warn'
            />
          </dl>
        </div>
      </div>

      {/* 预设档位 */}
      <div className='bg-card mt-6 overflow-hidden rounded-2xl border'>
        <div className='border-b px-6 py-3.5 text-[13.5px] font-medium'>
          {t('Quick table at the current scale')}
        </div>
        <div className='overflow-x-auto'>
          <table className='w-full text-[13px]'>
            <thead className='text-muted-foreground bg-muted/40 text-left text-xs'>
              <tr>
                <th className='px-6 py-2.5 font-medium'>
                  {t('Upstream cost')}
                </th>
                <th className='px-4 py-2.5 font-medium'>{t('Raw credits')}</th>
                <th className='px-4 py-2.5 font-medium'>
                  {t('Rounded credits')}
                </th>
                <th className='px-4 py-2.5 font-medium'>{t('Customer pays')}</th>
                <th className='px-4 py-2.5 font-medium'>{t('Margin')}</th>
              </tr>
            </thead>
            <tbody>
              {presets.map((preset) => {
                const raw = muFromCost(preset, derived)
                const charged = niceMu(raw)
                const pay = charged * derived.muPrice
                const m = pay > 0 ? 1 - preset / pay : 0
                return (
                  <tr key={preset} className='border-t'>
                    <td className='px-6 py-2.5 tabular-nums'>
                      {fmtMoney(preset, 3)}
                    </td>
                    <td className='text-muted-foreground px-4 py-2.5 tabular-nums'>
                      {raw.toFixed(2)}
                    </td>
                    <td className='px-4 py-2.5 font-medium tabular-nums'>
                      {charged.toFixed(1)}
                    </td>
                    <td className='px-4 py-2.5 tabular-nums'>{fmtMoney(pay)}</td>
                    <td
                      className={`px-4 py-2.5 tabular-nums ${
                        m >= policy.targetMargin
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {fmtPct(m)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className='text-muted-foreground bg-muted/40 rounded-2xl px-5 py-4 text-[12.5px] leading-[1.75]'>
        <p className='font-mono'>
          raw = cost ÷ c_mu ｜ c_mu = USDExchangeRate × QuotaPerMu ÷ QuotaPerUnit ｜
          pay = 幕 × (1 ÷ MuPerRMB)
        </p>
        <p className='mt-1.5'>
          {t(
            'Numbers here are derived from the pricing scale above. If a row looks wrong, fix the scale — not the calculator.'
          )}
        </p>
      </div>
    </SettingsSection>
  )
}

function Row({
  label,
  value,
  strong,
  tone,
}: {
  label: string
  value: string
  strong?: boolean
  tone?: 'good' | 'warn' | 'bad'
}) {
  const toneClass =
    tone === 'good'
      ? 'text-emerald-600 dark:text-emerald-400'
      : tone === 'warn'
        ? 'text-amber-600 dark:text-amber-400'
        : tone === 'bad'
          ? 'text-rose-600 dark:text-rose-400'
          : ''
  return (
    <div className='flex items-baseline justify-between gap-3'>
      <dt className='text-muted-foreground'>{label}</dt>
      <dd
        className={`tabular-nums ${strong ? 'text-foreground font-semibold' : ''} ${toneClass}`}
      >
        {value}
      </dd>
    </div>
  )
}
