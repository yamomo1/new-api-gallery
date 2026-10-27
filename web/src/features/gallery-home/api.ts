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
import { normalizeHomeConfig, type HomeConfigV2 } from './schema'
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

/* ------------------------------------------------------------------
 * 03 作品来源：后台可选手动挑选，或自动取画廊「最新 / 最热门」
 * ------------------------------------------------------------------ */

export type GalleryCardItem = {
  id?: number
  title: string
  model: string
  kind: 'image' | 'video'
  cover?: string
  video?: string
  url: string
}

const VIDEO_EXT = /\.(mp4|webm|mov|m4v)(\?|$)/i

/** media 字段是 JSON 数组字符串；坏数据一律当空数组 */
export function parseGalleryMedia(media: string): string[] {
  try {
    const parsed = JSON.parse(media || '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (x): x is string => typeof x === 'string' && x.trim() !== '',
    )
  } catch {
    return []
  }
}

/** 画廊作品 → 首页作品卡（封面 / 悬停视频 / 类型 / 标题 / 模型） */
export function toGalleryCard(item: {
  id?: number
  title: string
  model: string
  type: string
  cover: string
  media: string
}): GalleryCardItem {
  const media = parseGalleryMedia(item.media)
  const isVideo = item.type === 'video'
  const videoFromMedia = media.find((m) => VIDEO_EXT.test(m))
  const videoFromCover = VIDEO_EXT.test(item.cover || '') ? item.cover : undefined
  return {
    id: item.id,
    title: item.title,
    model: item.model,
    kind: isVideo ? 'video' : 'image',
    cover: item.cover || media[0] || '',
    video: isVideo ? (videoFromMedia ?? videoFromCover) : undefined,
    url: '/prompt-gallery',
  }
}

/**
 * 按后台来源拉取首页 03 的作品：
 * - manual  不请求，直接返回空数组（调用方用手选 items）
 * - latest  画廊最新发布
 * - popular 画廊最热门
 * 失败或为空时调用方回退到内置/手选数据，不会出现空区块。
 */
export function useGalleryFeed(
  source: string,
  limit: number,
): { items: GalleryCardItem[]; isLoading: boolean } {
  const enabled = source === 'latest' || source === 'popular'
  const take = Math.min(Math.max(Number(limit) || 5, 1), 24)
  /** 首页只展示 take 条，但要多取一些做池子，图片/视频筛选后才够各自的数量 */
  const pool = Math.min(Math.max(take * 3, 15), 24)
  const { data, isLoading } = useQuery({
    queryKey: ['gallery-home', 'gallery-feed', source, take],
    enabled,
    staleTime: 5 * 60 * 1000,
    retry: 1,
    queryFn: async () => {
      const params = new URLSearchParams({
        sort: source === 'popular' ? 'popular' : 'latest',
        limit: String(pool),
        offset: '0',
      })
      const res = await fetch(`/api/prompt-gallery/v1/prompts?${params.toString()}`, {
        headers: { Accept: 'application/json' },
      })
      if (!res.ok) throw new Error(`gallery feed ${res.status}`)
      const body = (await res.json()) as {
        data?: { items?: Parameters<typeof toGalleryCard>[0][] }
      }
      return (body.data?.items ?? []).map(toGalleryCard)
    },
  })
  return { items: enabled ? (data ?? []) : [], isLoading }
}

export type GalleryHomeContent = {
  home: HomeContent
  motion: MotionContent
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
      isLoading,
    }
  }, [data, isLoading, lang, t])
}
