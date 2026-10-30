/**
 * 投稿表单字段可见性（二开）
 * ------------------------------------------------------------------
 * 后台 Option `GalleryFormFields` 是一个逗号分隔的字段名列表，
 * 经 `/api/status` 的 `gallery_form_fields` 下发到前端。
 * 运营侧想临时关掉某个字段（比如不需要「分类」），改 Option 即可，
 * 不用重新发版。
 *
 * 约定：
 * - 列表为空的未知值 → 回退到 DEFAULT_FORM_FIELDS（宁可多显示，不可漏字段）
 * - `title` / `prompt` / `cover` 是必填项，无论配置怎么写都强制保留，
 *   否则前端校验和提交都会卡死
 */
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import { statusQueryOptions } from '@/lib/status-query'

/** 与后端 `model/option.go` 的默认值保持一致 */
export const DEFAULT_FORM_FIELDS = [
  'title',
  'prompt',
  'prompt_en',
  'model',
  'type',
  'cover',
  'category',
  'tags',
] as const

export type GalleryFormField = (typeof DEFAULT_FORM_FIELDS)[number]

/** 必填/核心字段：即使后台把它从配置里删掉，前端也要渲染出来 */
const REQUIRED_FIELDS: readonly GalleryFormField[] = ['title', 'prompt', 'cover']

const KNOWN_FIELDS = new Set<string>(DEFAULT_FORM_FIELDS)

/** 把一个逗号分隔的配置串解析成合法的字段集合 */
export function parseFormFields(raw: unknown): Set<GalleryFormField> {
  const text = typeof raw === 'string' ? raw.trim() : ''
  if (!text) return new Set(DEFAULT_FORM_FIELDS)

  const picked = new Set<GalleryFormField>()
  for (const piece of text.split(',')) {
    const name = piece.trim()
    if (KNOWN_FIELDS.has(name)) picked.add(name as GalleryFormField)
  }
  // 全是不认识的字段名 → 视为配置损坏，回落默认，避免表单变成空白
  if (picked.size === 0) return new Set(DEFAULT_FORM_FIELDS)

  for (const required of REQUIRED_FIELDS) picked.add(required)
  return picked
}

/**
 * 返回一个 `isVisible(field)` 判定函数。
 *
 * status 还在加载时按「全部可见」处理 —— 首屏闪一下字段比闪没有字段好，
 * 而且缓存里有旧值时会立刻命中。
 */
export function useGalleryFormFields(): {
  visible: (field: GalleryFormField) => boolean
  loaded: boolean
} {
  const { data, isLoading } = useQuery(statusQueryOptions)

  const fields = useMemo(
    () => parseFormFields(data?.gallery_form_fields),
    [data?.gallery_form_fields]
  )

  return useMemo(
    () => ({
      visible: (field) => fields.has(field),
      loaded: !isLoading,
    }),
    [fields, isLoading]
  )
}
