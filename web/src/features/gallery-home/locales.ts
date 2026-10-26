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
 * 首页多语种常量（前台解析 + 后台编辑共用）
 * ------------------------------------------------------------------
 * 语种列表以 New API 的 `INTERFACE_LANGUAGE_OPTIONS` 为单一真源，
 * 保证后台能编辑的语种 === 站点能切换的语种。
 */

import {
  INTERFACE_LANGUAGE_OPTIONS,
  normalizeInterfaceLanguage,
} from '@/i18n/languages'

/** 后台表单 Tab 的展示顺序：英文兜底语种排在最前 */
const LOCALE_ORDER = ['en', 'zhCN', 'zhTW', 'ja', 'fr', 'ru', 'vi']

export const HOME_LOCALES = [...INTERFACE_LANGUAGE_OPTIONS]
  .sort(
    (a, b) =>
      LOCALE_ORDER.indexOf(a.code) - LOCALE_ORDER.indexOf(b.code),
  )
  .map((o) => o.code) as [string, ...string[]]

export type HomeLocaleCode = string

/** 兜底语种：任何语种没填的字段都会先回退到它 */
export const HOME_FALLBACK_LOCALE = 'en'

/** 语种 → 母语名（如 English / 简体中文），Tab 上直接显示，无需翻译 */
export const HOME_LOCALE_LABELS: Record<string, string> = Object.fromEntries(
  INTERFACE_LANGUAGE_OPTIONS.map((o) => [o.code, o.label]),
)

/**
 * 把 i18next 的 language（可能是 zh-CN / en-US / 未知串）归一化成
 * 后台可用的语种 code；无法识别时回退英文。
 */
export function normalizeHomeLocale(value?: string | null): string {
  return normalizeInterfaceLanguage(value)
}
