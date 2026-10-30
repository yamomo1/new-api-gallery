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
import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'

import { convertDetectedLanguage } from './languages'
// 只有英文兜底包跟着主 chunk 走。7 个语言包合计约 4.5MB 源码，
// 全量静态 import 会把首屏 JS 撑大一倍以上（gzip 约 +1MB），
// 而用户实际只会用到其中一种 —— 其余按需动态加载。
import en from './locales/en.json'

/** 语言包懒加载器：键名与 resources 里的语言码一致 */
const bundles: Record<
  string,
  () => Promise<{ default: Record<string, unknown> }>
> = {
  zhCN: () => import('./locales/zh.json'),
  zhTW: () => import('./locales/zh-TW.json'),
  fr: () => import('./locales/fr.json'),
  ru: () => import('./locales/ru.json'),
  ja: () => import('./locales/ja.json'),
  vi: () => import('./locales/vi.json'),
}

/** 兼容旧引用：现在只预置英文，其余语言运行时补进 i18n。 */
export const resources = { en } as const

const SUPPORTED = ['en', 'zhCN', 'fr', 'ru', 'ja', 'vi', 'zhTW'] as const

const initPromise = i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    // 允许「部分语言预打包」：没在 resources 里的语言由 ensureLanguageBundle 补齐
    partialBundledLanguages: true,
    fallbackLng: 'en',
    supportedLngs: [...SUPPORTED],
    load: 'currentOnly',
    nsSeparator: false, // Allow literal colons in keys (e.g., URLs, labels)
    debug: import.meta.env.DEV,
    interpolation: {
      escapeValue: false, // not needed for react as it escapes by default
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      // Browsers report `zh-CN`/`zh-TW`/`zh`; map them onto our `zhCN`/`zhTW`
      // codes (non-Chinese codes pass through for normal supportedLngs matching).
      convertDetectedLanguage,
    },
  })

/** 把 i18n.language（可能是 zh-CN / zhcn）归一到 resources 的键名 */
function toBundleKey(lng?: string): string | null {
  if (!lng) return null
  const raw = lng.replace('_', '-').toLowerCase()
  if (raw.startsWith('zh')) {
    return raw.includes('tw') || raw.includes('hk') || raw.includes('mo')
      ? 'zhTW'
      : 'zhCN'
  }
  for (const code of SUPPORTED) {
    const lower = code.toLowerCase()
    if (lower === raw || lower === raw.split('-')[0]) {
      return code
    }
  }
  return null
}

const loading = new Map<string, Promise<void>>()

/**
 * 确保当前语言的词条已就绪。
 * en 已内联；其余语言动态 import 一次并缓存（i18n 内部也会持有）。
 */
export function ensureLanguageBundle(lng?: string): Promise<void> {
  const key = toBundleKey(lng || i18n.resolvedLanguage || i18n.language)
  if (!key || key === 'en') return Promise.resolve()
  const existing = loading.get(key)
  if (existing) return existing

  const task = (async () => {
    const load = bundles[key]
    if (!load) return
    const mod = await load()
    i18n.addResourceBundle(key, 'translation', mod.default, true, true)
  })().catch(() => {
    // 语言包拉取失败不应该阻塞页面：回退英文即可
  })
  loading.set(key, task)
  return task
}

// 运行时切换语言（后台设置或语言选择器）时补词条
i18n.on('languageChanged', (lng) => {
  void ensureLanguageBundle(lng)
})

/**
 * 切换语言：先把词条拉下来再切。
 * 直接 changeLanguage 会先渲染一次缺词的界面（英文兜底闪一下），
 * 而且 addResourceBundle 只发 'added' 事件，组件不一定重渲染。
 */
export async function changeLanguageWithBundle(lng: string): Promise<void> {
  await ensureLanguageBundle(lng)
  await i18n.changeLanguage(lng)
}

/**
 * 启动序列：等 i18n 初始化完 + 当前语言包到位再渲染，
 * 避免「先闪一眼英文再变中文」的抖动。
 */
export async function bootstrapI18n(): Promise<void> {
  await initPromise
  await ensureLanguageBundle()
}

export default i18n
