import { api } from '@/lib/api'

export interface ModelProfitItem {
  model_name: string
  requests: number
  prompt_tokens: number
  completion_tokens: number
  revenue_quota: number
  cost_quota: number
  profit_quota: number
  margin: number
  cost_configured: boolean
}

export interface ProfitSummary {
  revenue_quota: number
  cost_quota: number
  profit_quota: number
  margin: number
  requests: number
  prompt_tokens: number
  completion_tokens: number
  cost_configured: boolean
}

export interface ModelProfitResponse {
  items: ModelProfitItem[]
  summary: ProfitSummary
  quota_per_unit: number
}

export interface GetModelProfitParams {
  startTimestamp?: number
  endTimestamp?: number
}

export async function getModelProfit(
  params: GetModelProfitParams = {},
): Promise<ModelProfitResponse> {
  const res = await api.get<{ success: boolean; data?: ModelProfitResponse }>(
    '/api/log/profit',
    {
      params: {
        start_timestamp: params.startTimestamp || 0,
        end_timestamp: params.endTimestamp || 0,
      },
    },
  )
  return (
    res.data.data ?? {
      items: [],
      quota_per_unit: 500000,
      summary: {
        revenue_quota: 0,
        cost_quota: 0,
        profit_quota: 0,
        margin: 0,
        requests: 0,
        prompt_tokens: 0,
        completion_tokens: 0,
        cost_configured: false,
      },
    }
  )
}

export type UpstreamCostTable = Record<
  string,
  { in: number; out: number }
>

export async function getUpstreamCost(): Promise<UpstreamCostTable> {
  const res = await api.get<{
    success: boolean
    data?: UpstreamCostTable
  }>('/api/log/upstream-cost')
  return res.data.data ?? {}
}

export async function saveUpstreamCost(
  table: UpstreamCostTable,
): Promise<void> {
  await api.put('/api/log/upstream-cost', { data: JSON.stringify(table) })
}
