/*
 * 读 New API 的「模型资料」作为「选择模型」弹窗的数据源。
 *
 * 数据来自 GET /api/model-catalog（UserAuth）：
 *   - 名称、说明、图标、标签 → 后台「模型资料」维护（model 表）
 *   - 分类（image / video / text）→ 端点类型 + 标签声明 + 名称兜底
 *   - NEW 角标 → 创建时间在 30 天内
 *
 * 与 `use-model-catalog`（GalleryModelCatalog，Fork 自维护目录）的关系：
 * 服务端有该分类的模型时优先用服务端；没有则回退自维护目录，保证页面不空。
 */
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import { api } from '@/lib/api'
import type { CatalogModel, ModelCategory } from '@/lib/model-catalog'

export type ServerModelEntry = {
  model_name: string
  category: 'image' | 'video' | 'text'
  description?: string
  icon?: string
  tags?: string[]
  new?: boolean
  vendor_name?: string
  vendor_icon?: string
  endpoints?: string[]
}

const ICON_KEYS = new Set(['spark', 'wave', 'hex', 'orbit', 'leaf'])

function looksLikeUrl(value: string): boolean {
  return /^(https?:)?\/\//.test(value) || value.startsWith('data:')
}

/** 服务端条目 → 弹窗卡片模型 */
export function toCatalogModel(entry: ServerModelEntry): CatalogModel {
  const rawIcon = (entry.icon ?? '').trim()
  const vendorIcon = (entry.vendor_icon ?? '').trim()
  // 优先级：模型自定义图标（URL / 图标键）→ 供应商图标 → 默认 spark
  let icon: string | undefined
  let iconUrl: string | undefined
  for (const candidate of [rawIcon, vendorIcon]) {
    if (!candidate) continue
    if (looksLikeUrl(candidate)) {
      iconUrl = candidate
      break
    }
    if (ICON_KEYS.has(candidate)) {
      icon = candidate
      break
    }
    // emoji 或单字：直接当图标内容渲染
    icon = candidate
    break
  }

  return {
    id: entry.model_name,
    name: entry.model_name,
    description: entry.description,
    tags: entry.tags,
    badge: entry.new ? 'NEW' : undefined,
    category: entry.category === 'video' ? 'video' : 'image',
    icon,
    iconUrl,
    enabled: true,
  }
}

export function useServerModelCatalog() {
  return useQuery({
    queryKey: ['public-model-catalog'],
    queryFn: async () => {
      const res = await api.get('/api/model-catalog')
      const payload = res?.data as
        | { success?: boolean; data?: ServerModelEntry[] }
        | undefined
      return (payload?.data ?? []) as ServerModelEntry[]
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })
}

/** 按页面分类取模型；服务端无该类模型时返回空数组（由调用方决定是否回退） */
export function useServerModelsByCategory(category: ModelCategory): {
  models: CatalogModel[]
  isLoading: boolean
  hasServerData: boolean
} {
  const query = useServerModelCatalog()
  const all = query.data ?? []

  return useMemo(() => {
    const filtered = all
      .filter((entry) => entry.category === category)
      .map(toCatalogModel)
    return {
      models: filtered,
      isLoading: query.isLoading,
      hasServerData: all.length > 0,
    }
  }, [all, category, query.isLoading])
}
