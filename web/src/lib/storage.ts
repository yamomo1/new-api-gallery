import { useEffect, useReducer } from 'react'

import { api } from '@/lib/http-client'

export interface StorageUploadResponse {
  success: boolean
  message?: string
  data?: string
  key?: string
}

export interface StorageConfig {
  overseas_enabled: boolean
  cn_base: string
  overseas_base: string
}

type Region = 'cn' | 'overseas'

const REGION_CACHE_KEY = 'storage_region_cache'
const REGION_CACHE_TTL = 6 * 60 * 60 * 1000 // 6 小时
const PROBE_TIMEOUT = 3000

let configPromise: Promise<StorageConfig> | null = null
let regionPromise: Promise<Region> | null = null

// —— 上传 ——

// 调用全站通用上传接口。返回 url（主存储完整地址）与 key（相对路径，
// 存库时保存 key，展示时按用户地域解析成国内/海外地址）。
export async function uploadImage(
  file: File,
  signal?: AbortSignal,
): Promise<{ url: string; key: string }> {
  const form = new FormData()
  form.append('file', file)

  const res = await api.post<StorageUploadResponse>(
    '/api/storage/upload',
    form,
    { signal },
  )
  const data = res.data
  if (!data?.success || !data.data) {
    throw new Error(data?.message || 'Upload failed')
  }
  return { url: data.data, key: data.key || data.data }
}

// —— 地域检测 ——

// 我们生成的主存储 key 形如 uploads/20060102/<uuid>.<ext>；
// 历史数据与外链是完整 URL（http 开头或以 / 开头），原样返回。
function isStorageKey(src: string): boolean {
  return /^uploads\/\d{8}\//.test(src)
}

function getConfig(): Promise<StorageConfig> {
  if (!configPromise) {
    configPromise = api
      .get<{ success: boolean; data?: StorageConfig }>('/api/storage/config')
      .then((res) => res.data?.data ?? emptyConfig())
      .catch(() => emptyConfig())
  }
  return configPromise
}

function emptyConfig(): StorageConfig {
  return { overseas_enabled: false, cn_base: '', overseas_base: '' }
}

function readCachedRegion(): Region | null {
  try {
    const raw = localStorage.getItem(REGION_CACHE_KEY)
    if (!raw) return null
    const { region, ts } = JSON.parse(raw) as { region: Region; ts: number }
    if (Date.now() - ts > REGION_CACHE_TTL) return null
    return region
  } catch {
    return null
  }
}

// 探针：主站本身必然可达（页面已经打开了），所以只需要测海外域名。
// fetch no-cors 模式下只要网络层通（哪怕 404）就 resolve，DNS/网络失败才 reject。
async function probeOverseas(base: string): Promise<boolean> {
  try {
    await fetch(base + '/favicon.ico', {
      mode: 'no-cors',
      cache: 'no-store',
      signal: AbortSignal.timeout(PROBE_TIMEOUT),
    })
    return true
  } catch {
    return false
  }
}

async function detectRegion(): Promise<Region> {
  const cached = readCachedRegion()
  if (cached) return cached
  const cfg = await getConfig()
  let region: Region = 'cn'
  if (cfg.overseas_enabled && cfg.overseas_base) {
    const overseasOk = await probeOverseas(cfg.overseas_base)
    region = overseasOk ? 'overseas' : 'cn'
  }
  try {
    localStorage.setItem(
      REGION_CACHE_KEY,
      JSON.stringify({ region, ts: Date.now() }),
    )
  } catch {
    /* ignore */
  }
  return region
}

// 应用启动/画廊页挂载时调用一次；幂等。
export function initStorageRegion(): Promise<Region> {
  if (!regionPromise) {
    regionPromise = detectRegion()
  }
  return regionPromise
}

// —— URL 解析 ——

// 同步解析：key 按当前地域拼公开基址；完整 URL / 旧数据原样返回。
// region 未就绪时按国内处理（国内用户永远正确，海外用户首屏可能闪换一次，
// useResolvedImageUrl 会在检测完成后自动刷新）。
let cachedConfig: StorageConfig | null = null
getConfig().then((cfg) => {
  cachedConfig = cfg
})

export function resolveImageUrl(src?: string | null): string {
  if (!src) return ''
  if (!isStorageKey(src)) return src

  const region = readCachedRegion() ?? 'cn'
  let base = ''
  if (region === 'overseas' && cachedConfig?.overseas_base) {
    base = cachedConfig.overseas_base
  } else if (cachedConfig?.cn_base) {
    base = cachedConfig.cn_base
  }
  if (!base) return src
  return base.replace(/\/+$/, '') + '/' + src.replace(/^\/+/, '')
}

// —— React hook ——

// 组件里用：返回 resolve 后的 URL，并在地域检测完成（可能推翻首次结果）后自动刷新。
export function useResolvedImageUrl(src?: string | null): string {
  const [, force] = useReducer((x: number) => x + 1, 0)

  useEffect(() => {
    let cancelled = false
    initStorageRegion().then(() => {
      if (!cancelled) force()
    })
    return () => {
      cancelled = true
    }
  }, [])

  return resolveImageUrl(src)
}
