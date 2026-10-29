import { resolveImageUrl } from '@/lib/storage'

import type { PromptGalleryItem } from './types'

// ----------------------------------------------------------------------------
// 画廊工具：媒体/标签解析 + 本地收藏、点赞记录（localStorage）
// ----------------------------------------------------------------------------

const FAVORITES_KEY = 'prompt-gallery:favorites'
const LIKED_KEY = 'prompt-gallery:liked'

/** 解析 media 字段（JSON 数组字符串），失败时回退 cover；每项按用户地域解析成国内外地址 */
export function parseGalleryMedia(item: PromptGalleryItem): string[] {
  const list: string[] = []
  try {
    const parsed = JSON.parse(item.media || '[]')
    if (Array.isArray(parsed)) {
      for (const v of parsed) {
        if (typeof v === 'string' && v) list.push(resolveImageUrl(v))
      }
    }
  } catch {
    // 忽略解析失败
  }
  if (list.length === 0 && item.cover) {
    list.push(resolveImageUrl(item.cover))
  }
  return list
}

/** 解析 tags 字段：兼容 JSON 数组字符串与逗号分隔字符串 */
export function parseGalleryTags(tags: string): string[] {
  if (!tags) return []
  const trimmed = tags.trim()
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed)
      if (Array.isArray(parsed)) {
        return parsed.filter((v) => typeof v === 'string' && v.trim())
      }
    } catch {
      // 回退到逗号分隔
    }
  }
  return trimmed
    .split(/[,，]/)
    .map((v) => v.trim())
    .filter(Boolean)
}

function readIdSet(key: string): Set<number> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = window.localStorage.getItem(key)
    const arr = raw ? (JSON.parse(raw) as unknown) : []
    if (!Array.isArray(arr)) return new Set()
    return new Set(arr.filter((v): v is number => typeof v === 'number'))
  } catch {
    return new Set()
  }
}

function writeIdSet(key: string, set: Set<number>) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, JSON.stringify([...set]))
  } catch {
    // 忽略配额/隐私模式错误
  }
}

export function readFavorites(): Set<number> {
  return readIdSet(FAVORITES_KEY)
}

export function writeFavorites(set: Set<number>) {
  writeIdSet(FAVORITES_KEY, set)
}

export function readLiked(): Set<number> {
  return readIdSet(LIKED_KEY)
}

export function writeLiked(set: Set<number>) {
  writeIdSet(LIKED_KEY, set)
}

/** 视频文件扩展名判断（用于卡片/详情选择播放器） */
export function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|mov|m3u8)(\?|$)/i.test(url)
}

/**
 * 复制文本：优先 Clipboard API（HTTPS），
 * 非安全上下文 / 无权限时回退 execCommand，避免 http 部署下「复制失败」。
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // 继续走兜底
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.top = '-1000px'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}
