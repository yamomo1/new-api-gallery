/**
 * 「去创作」四个功能开关（二开）
 * ------------------------------------------------------------------
 * 后台 Option `GalleryCreateConfig` 是一段 JSON：
 *   { netdisk_download, comfyui_node, runninghub, manual_workflow }
 * 经 `/api/status` 的 `gallery_create_config` 下发到前端。
 *
 * 约定：
 * - 未配置 / 解析失败 → 四项全开（宁可多显示，不可漏功能）
 * - 只有显式 `false` 才算关闭，避免旧数据/半截 JSON 误关功能
 */
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import { statusQueryOptions } from '@/lib/status-query'

import type { GalleryCreateConfig } from './types'

export const DEFAULT_CREATE_CONFIG: GalleryCreateConfig = {
  netdisk_download: true,
  comfyui_node: true,
  runninghub: true,
  manual_workflow: true,
}

const KEYS: (keyof GalleryCreateConfig)[] = [
  'netdisk_download',
  'comfyui_node',
  'runninghub',
  'manual_workflow',
]

/** 把后台下发的原始值（JSON 字符串）解析成开关对象 */
export function parseGalleryCreateConfig(raw: unknown): GalleryCreateConfig {
  if (typeof raw !== 'string' || !raw.trim()) return DEFAULT_CREATE_CONFIG
  try {
    const parsed = JSON.parse(raw) as Partial<Record<keyof GalleryCreateConfig, unknown>>
    const next = { ...DEFAULT_CREATE_CONFIG }
    for (const key of KEYS) {
      // 只有明确写成 false 才关闭
      if (parsed[key] === false) next[key] = false
    }
    return next
  } catch {
    return DEFAULT_CREATE_CONFIG
  }
}

export function useGalleryCreateConfig(): {
  config: GalleryCreateConfig
  loaded: boolean
} {
  const { data, isLoading } = useQuery(statusQueryOptions)

  const config = useMemo(
    () => parseGalleryCreateConfig(data?.gallery_create_config),
    [data?.gallery_create_config]
  )

  return { config, loaded: !isLoading }
}
