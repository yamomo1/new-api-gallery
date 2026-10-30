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
 * 当前实际生效的语言码（未归一化）。
 *
 * 坑：`partialBundledLanguages: true` 时 i18next 认为所有语言都已预置，
 * 没命中 resources 的语言会被直接「解析」到 fallbackLng —— 于是
 * `i18n.resolvedLanguage` 恒等于 'en'，哪怕后来 addResourceBundle 注入了
 * zhCN 也不会变。所以这里**只能**用 `i18n.language`（用户选择值），
 * 一旦误用 resolvedLanguage，中文用户拿到的 bundle key 永远是 'en'，
 * 语言包永远不会被 import，全站退化成英文。
 */
function currentLanguageCode(): string {
  // 注意：不要在这里加 `|| i18n.resolvedLanguage` 兜底 —— 它恒为 'en'，
  // 一旦参与取值就会把中文用户静默降级成英文。
  return i18n.language || 'en'
}

/**
 * 确保当前语言的词条已就绪。
 * en 已内联；其余语言动态 import 一次并缓存（i18n 内部也会持有）。
 */
export function ensureLanguageBundle(lng?: string): Promise<void> {
  const key = toBundleKey(lng || currentLanguageCode())
  if (!key || key === 'en') return Promise.resolve()
  const existing = loading.get(key)
  if (existing) return existing

  const task = (async () => {
    const load = bundles[key]
    if (!load) return
    const mod = await load()
    i18n.addResourceBundle(key, 'translation', mod.default, true, true)
  })()
  // 失败不能写进 loading 缓存：否则这个语言会被永久标记为「已加载」，
  // 用户之后再怎么切都拿不到词条（只能刷新页面）。
  task.catch(() => {
    loading.delete(key)
  })
  loading.set(key, task)
  return task
}

// 运行时切换语言（后台设置或语言选择器）时补词条。
// 这里同样会有一个窗口期：languageChanged 已发出、但 bundle 还在下载，
// 期间组件渲染的是 fallback 英文。调用方应优先用 changeLanguageWithBundle()
// （先把词条拿到手再切），这条监听只作为兜底，保证「词条最终会到」。
i18n.on('languageChanged', (lng) => {
  void ensureLanguageBundle(lng).catch(() => {})
})

/**
 * 切换语言：先把词条拉下来再切。
 * 直接 changeLanguage 会先渲染一次缺词的界面（英文兜底闪一下），
 * 而且 addResourceBundle 只发 'added' 事件，组件不一定重渲染 ——
 * 所以顺序必须是 ensure（拉词条）→ changeLanguage（切）。
 */
export async function changeLanguageWithBundle(lng: string): Promise<void> {
  // 归一化：调用方可能传 'zh-CN' / 'zh_TW' 这类标准标签，但 supportedLngs
  // 里只有 'zhCN' / 'zhTW'，原样传进去会被 supportedLngs 拦掉退回 en。
  const target = toBundleKey(lng) ?? lng
  try {
    await ensureLanguageBundle(target)
  } catch {
    // 语言包拉不下来也别拦住切换：至少语言偏好要生效，下次刷新会重试
  }
  await i18n.changeLanguage(target)
}

/**
 * 启动序列：等 i18n 初始化完 + 当前语言包到位再渲染，
 * 避免「先闪一眼英文再变中文」的抖动。
 *
 * 语言包拉取失败不能阻塞渲染 —— 否则一个 4xx 的 chunk 会让整站白屏，
 * 比「暂时显示英文」严重得多。
 */
export async function bootstrapI18n(): Promise<void> {
  await initPromise
  try {
    await ensureLanguageBundle()
  } catch {
    // 忽略：回退英文渲染，后续切换语言时还会重试
  }
}

export default i18n
