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
 * 「幕」换算核心。
 *
 * 与 docs/mu_billing_calc.py 同一套公式，任一侧改常数另一侧必须同步：
 *
 *   1 美元        = QuotaPerUnit quota = K 幕
 *   1 幕          = QuotaPerMu quota
 *   K             = QuotaPerUnit / QuotaPerMu
 *   单幕成本 c_mu = FX / K       （元）
 *   单幕售价 p_mu = 1 / MuPerRMB （元）
 *   实际毛利 m    = 1 - c_mu / p_mu
 *   成本 → 幕 raw = costRmb / c_mu
 *   目标所需 Price = QuotaPerUnit / (QuotaPerMu × MuPerRMB)
 */
export type PricingPolicy = {
  muEnabled: boolean
  muPerRmb: number
  quotaPerMu: number
  baseMargin: number
  targetMargin: number
  quotaPerUnit: number
  usdExchangeRate: number
}

export type PricingDerived = {
  /** K：1 美元能买多少幕 */
  muPerUsd: number
  /** 单幕上游成本（元） */
  costPerMu: number
  /** 单幕售价（元） */
  muPrice: number
  /** 1 元发多少 quota */
  quotaPerRmb: number
  /** 当前口径下的真实毛利率 */
  margin: number
  /** 要让 1 元恰好吃到 MuPerRMB 幕，所需的充值单价 Price */
  expectedPrice: number
}

const pos = (value: number, fallback: number) =>
  Number.isFinite(value) && value > 0 ? value : fallback

export function derivePolicy(policy: PricingPolicy): PricingDerived {
  const quotaPerUnit = pos(policy.quotaPerUnit, 500000)
  const quotaPerMu = pos(policy.quotaPerMu, 5136)
  const muPerRmb = pos(policy.muPerRmb, 10)
  const fx = pos(policy.usdExchangeRate, 7)

  const muPerUsd = quotaPerUnit / quotaPerMu
  const costPerMu = fx / muPerUsd
  const muPrice = 1 / muPerRmb

  return {
    muPerUsd,
    costPerMu,
    muPrice,
    quotaPerRmb: muPerRmb * quotaPerMu,
    margin: 1 - costPerMu / muPrice,
    // Price 是「1 美元额度卖多少元」，要让它等于 1 元买 MuPerRMB 幕，
    // 就必须 Price = QuotaPerUnit / (QuotaPerMu × MuPerRMB)
    expectedPrice: quotaPerUnit / (quotaPerMu * muPerRmb),
  }
}

/** 挂牌幕取整：<1 取 0.1 / 1–20 取 0.5 / 20–100 取 1 / >100 取 2，一律向上 */
export function niceMu(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return 0
  const step = raw < 1 ? 0.1 : raw < 20 ? 0.5 : raw < 100 ? 1 : 2
  return Number(Math.max(0.1, Math.ceil(raw / step) * step).toFixed(2))
}

/** 成本（元）→ 理论幕（未取整）：raw = costRmb / c_mu */
export function muFromCost(costRmb: number, derived: PricingDerived): number {
  if (!Number.isFinite(costRmb) || costRmb <= 0 || derived.costPerMu <= 0) {
    return 0
  }
  return costRmb / derived.costPerMu
}

/** quota → 上游成本价值（元）。仅用于诊断口径，不用于定价 */
export function quotaToCostRmb(quota: number, policy: PricingPolicy): number {
  const quotaPerUnit = pos(policy.quotaPerUnit, 500000)
  const fx = pos(policy.usdExchangeRate, 7)
  if (!Number.isFinite(quota) || quota <= 0) return 0
  return (quota / quotaPerUnit) * fx
}

export function fmtMoney(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return '—'
  const abs = Math.abs(value)
  if (abs > 0 && abs < 0.01) return `¥${value.toFixed(4)}`
  return `¥${value.toLocaleString('zh-CN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`
}

export function fmtPct(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return '—'
  return `${(value * 100).toFixed(digits)}%`
}

/** 统计 JSON 条目数；解析失败返回 null */
export function countEntries(raw: string): number | null {
  const trimmed = (raw ?? '').trim()
  if (!trimmed) return 0
  try {
    const parsed = JSON.parse(trimmed)
    if (Array.isArray(parsed)) return parsed.length
    if (parsed && typeof parsed === 'object') return Object.keys(parsed).length
    return null
  } catch {
    return null
  }
}
