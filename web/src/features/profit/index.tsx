import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { CircleAlert, Save, TrendingUp } from 'lucide-react'

import { SectionPageLayout } from '@/components/layout'

import {
  getModelProfit,
  getUpstreamCost,
  saveUpstreamCost,
  type UpstreamCostTable,
} from './api'

// 额度与美元的换算来自后端（QuotaPerUnit），页面全部以美元展示。
function toUSD(quota: number, quotaPerUnit: number): number {
  if (!quotaPerUnit) return 0
  return quota / quotaPerUnit
}

function money(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 100) return `$${value.toFixed(0)}`
  if (abs >= 1) return `$${value.toFixed(2)}`
  return `$${value.toFixed(4)}`
}

interface RangeOption {
  label: string
  days: number
}

const RANGES: RangeOption[] = [
  { label: '24H', days: 1 },
  { label: '7D', days: 7 },
  { label: '30D', days: 30 },
  { label: 'ALL', days: 0 },
]

export function ProfitPage() {
  const { t } = useTranslation()
  const [days, setDays] = useState(30)
  const [costDraft, setCostDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['model-profit', days],
    queryFn: () =>
      getModelProfit({
        startTimestamp:
          days === 0
            ? 0
            : Math.floor(Date.now() / 1000) - days * 24 * 60 * 60,
      }),
  })

  useEffect(() => {
    void getUpstreamCost().then((table) => {
      setCostDraft(JSON.stringify(table, null, 2))
    })
  }, [])

  const unit = data?.quota_per_unit || 500000
  const rows = data?.items ?? []
  const summary = data?.summary

  const costMissing = useMemo(
    () => rows.filter((r) => !r.cost_configured).map((r) => r.model_name),
    [rows],
  )

  async function handleSaveCost() {
    setSaving(true)
    setSaved(false)
    try {
      const parsed = JSON.parse(costDraft) as UpstreamCostTable
      await saveUpstreamCost(parsed)
      setSaved(true)
    } catch {
      setSaved(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <SectionPageLayout fixedContent>
      <SectionPageLayout.Title>
        <span className='flex min-w-0 items-center gap-2'>
          <span className='truncate'>{t('Profit')}</span>
        </span>
      </SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <p className='pb-2 text-sm text-muted-foreground'>
          {t(
            'Revenue is what users were charged; cost comes from your upstream price table. Keeping them separate means retail tweaks never skew costing.',
          )}
        </p>

        <div className='flex flex-wrap items-center gap-2 pb-4'>
        {RANGES.map((r) => (
          <button
            key={r.label}
            type='button'
            onClick={() => setDays(r.days)}
            className={
              days === r.days
                ? 'rounded-md bg-primary px-3 py-1 text-sm text-primary-foreground'
                : 'rounded-md border px-3 py-1 text-sm'
            }
          >
            {r.label}
          </button>
        ))}
      </div>

      {summary && !summary.cost_configured ? (
        <div className='mb-4 flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm'>
          <CircleAlert className='mt-0.5 size-4 shrink-0' />
          <span>
            {t('No upstream cost configured yet — add prices below to see profit.')}
          </span>
        </div>
      ) : null}

      <div className='grid grid-cols-2 gap-3 pb-4 lg:grid-cols-4'>
        <StatCard
          label={t('Revenue')}
          value={money(toUSD(summary?.revenue_quota ?? 0, unit))}
        />
        <StatCard
          label={t('Upstream cost')}
          value={money(toUSD(summary?.cost_quota ?? 0, unit))}
        />
        <StatCard
          label={t('Gross profit')}
          value={money(toUSD(summary?.profit_quota ?? 0, unit))}
          highlight
        />
        <StatCard
          label={t('Margin')}
          value={`${((summary?.margin ?? 0) * 100).toFixed(1)}%`}
          highlight={(summary?.margin ?? 0) > 0}
        />
      </div>

      {isLoading ? (
        <div className='py-16 text-center text-sm text-muted-foreground'>
          {t('Loading…')}
        </div>
      ) : rows.length === 0 ? (
        <div className='py-16 text-center text-sm text-muted-foreground'>
          {t('No consumption in this period.')}
        </div>
      ) : (
        <div className='overflow-x-auto rounded-lg border'>
          <table className='w-full text-sm'>
            <thead className='bg-muted/50 text-left'>
              <tr>
                <Th>{t('Model')}</Th>
                <Th>{t('Requests')}</Th>
                <Th>{t('Revenue')}</Th>
                <Th>{t('Cost')}</Th>
                <Th>{t('Profit')}</Th>
                <Th>{t('Margin')}</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const negative = row.cost_configured && row.profit_quota < 0
                return (
                  <tr key={row.model_name} className='border-t'>
                    <td className='px-3 py-2 font-mono text-xs'>
                      {row.model_name}
                      {!row.cost_configured ? (
                        <span className='ml-2 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-600'>
                          {t('no cost')}
                        </span>
                      ) : null}
                    </td>
                    <td className='px-3 py-2'>{row.requests}</td>
                    <td className='px-3 py-2'>
                      {money(toUSD(row.revenue_quota, unit))}
                    </td>
                    <td className='px-3 py-2'>
                      {money(toUSD(row.cost_quota, unit))}
                    </td>
                    <td
                      className={
                        negative
                          ? 'px-3 py-2 text-red-500'
                          : 'px-3 py-2 text-emerald-600'
                      }
                    >
                      {money(toUSD(row.profit_quota, unit))}
                    </td>
                    <td className='px-3 py-2'>
                      {row.cost_configured
                        ? `${(row.margin * 100).toFixed(1)}%`
                        : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className='mt-6 space-y-2 rounded-lg border p-4'>
        <div className='flex items-center gap-2'>
          <TrendingUp className='size-4' />
          <h2 className='text-base font-semibold'>
            {t('Upstream cost table')}
          </h2>
        </div>
        <p className='text-xs text-muted-foreground'>
          {t(
            'JSON map of model → {"in": <USD per 1M input tokens>, "out": <USD per 1M output tokens>}. These are your purchase prices, independent of what you charge users.',
          )}
          {costMissing.length > 0 ? (
            <span className='mt-1 block text-amber-600'>
              {t('Missing:')} {costMissing.slice(0, 8).join(', ')}
              {costMissing.length > 8 ? ' …' : ''}
            </span>
          ) : null}
        </p>
        <textarea
          value={costDraft}
          onChange={(e) => setCostDraft(e.target.value)}
          rows={10}
          spellCheck={false}
          className='w-full rounded-md border bg-background p-2 font-mono text-xs'
        />
        <button
          type='button'
          onClick={() => void handleSaveCost()}
          disabled={saving}
          className='inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50'
        >
          <Save className='size-4' />
          {saving ? t('Saving…') : t('Save')}
        </button>
        {saved ? (
          <span className='ml-2 text-sm text-emerald-600'>
            {t('Saved')}
          </span>
        ) : null}
      </div>
    </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className='px-3 py-2 font-medium'>{children}</th>
}

function StatCard({
  label,
  value,
  highlight,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div className='rounded-lg border p-3'>
      <div className='text-xs text-muted-foreground'>{label}</div>
      <div
        className={
          highlight ? 'mt-1 text-lg font-semibold text-emerald-600' : 'mt-1 text-lg font-semibold'
        }
      >
        {value}
      </div>
    </div>
  )
}
