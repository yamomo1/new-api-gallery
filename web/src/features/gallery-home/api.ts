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
 * gallery-home 数据接入（TanStack Query）
 * ------------------------------------------------------------------
 * 替换原先手写 `fetch` + `useEffect`：换来缓存、重试、请求去重，
 * 以及 language / theme 切换后重新派生数据的一致性。
 */

import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import {
  buildHomeData,
  buildMotionData,
  mergeHomeConfig,
  resolveHomeOverride,
} from './data'
import { normalizeHomeLocale } from './locales'
import { normalizeHomeConfig, type HomeConfigV2, type PuckData } from './schema'
import type { HomeContent, MotionContent } from './types'

const HOME_CONFIG_KEY = ['gallery-home', 'home-config'] as const

/** 后台返回的 {success, data:"<json>"} 中提取原始对象；空/坏数据返回 null */
async function fetchRawHomeConfig(): Promise<HomeConfigV2 | null> {
  const res = await fetch('/api/home_config', { headers: { Accept: 'application/json' } })
  if (!res.ok) return null
  const body = (await res.json()) as { success?: boolean; data?: unknown }
  const raw = body?.data
  if (typeof raw !== 'string' || raw.trim() === '' || raw === 'null') return null
  try {
    return normalizeHomeConfig(JSON.parse(raw))
  } catch {
    return null
  }
}

type MotionOverride = NonNullable<HomeConfigV2['shared']>['motion']

export type GalleryHomeContent = {
  home: HomeContent
  motion: MotionContent
  /** Puck 可视化搭建布局（null = 用默认 8 区块顺序） */
  puck: PuckData | null
  isLoading: boolean
}

/**
 * 首页内容：内置默认（按当前语言翻译）深合并后台 HomeConfig 覆盖。
 * 后台没配置时 data 为 null → 结果就是完整默认值，不会白屏。
 */
export function useGalleryHomeContent(): GalleryHomeContent {
  const { t, i18n } = useTranslation()
  const lang = normalizeHomeLocale(i18n.language)
  const { data, isLoading } = useQuery({
    queryKey: HOME_CONFIG_KEY,
    queryFn: fetchRawHomeConfig,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })

  return useMemo(() => {
    let home = buildHomeData(t)
    let motion: MotionOverride = {}
    if (data) {
      const resolved = resolveHomeOverride(data, lang)
      for (const layer of resolved.layers) {
        home = mergeHomeConfig(home, layer)
      }
      motion = resolved.motion
    }
    return {
      home,
      motion: buildMotionData(t, motion),
      puck: (data?.puck as PuckData | undefined) ?? null,
      isLoading,
    }
  }, [data, isLoading, lang, t])
}
