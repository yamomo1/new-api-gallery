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
import { createInstance } from 'i18next'
import { describe, expect, test } from 'vitest'

/**
 * 回归测试：语言包按需加载不能依赖 `resolvedLanguage`。
 *
 * 背景（线上事故）：i18next 开了 `partialBundledLanguages: true` 后，
 * 未预置资源的语言会被直接「解析」到 fallbackLng，于是
 * `i18n.resolvedLanguage` 恒为 'en'。旧代码
 * `toBundleKey(lng || i18n.resolvedLanguage || i18n.language)` 因此永远拿到
 * 'en'，`ensureLanguageBundle()` 直接 return —— 中文包永不 import，
 * 全站退化成英文，切换语言也无效果。
 */
const SUPPORTED = ['en', 'zhCN', 'fr', 'ru', 'ja', 'vi', 'zhTW'] as const

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
    if (lower === raw || lower === raw.split('-')[0]) return code
  }
  return null
}

async function initLike(opts: { lng?: string }) {
  const i = createInstance()
  await i.init({
    resources: { en: { translation: { h: 'Hi' } } },
    partialBundledLanguages: true,
    fallbackLng: 'en',
    supportedLngs: [...SUPPORTED],
    load: 'currentOnly',
    ...opts,
  })
  return i
}

describe('语言包 key 解析', () => {
  test('partialBundledLanguages 会让 resolvedLanguage 恒为 fallback', async () => {
    // 这条断言是给后来人看的：不要以为 resolvedLanguage 能反映用户选择
    for (const lng of ['zhCN', 'fr', 'ja'] as const) {
      const i = await initLike({ lng })
      expect(i.resolvedLanguage).toBe('en')
      expect(i.language).toBe(lng)
    }
  })

  test('必须用 i18n.language 而非 resolvedLanguage 决定要拉哪个包', async () => {
    for (const [lng, expected] of [
      ['zhCN', 'zhCN'],
      ['fr', 'fr'],
      ['ja', 'ja'],
      ['zhTW', 'zhTW'],
    ] as const) {
      const i = await initLike({ lng })
      // 新逻辑
      expect(toBundleKey(i.language)).toBe(expected)
      // 旧逻辑（会退化成 en，导致永不加载）
      expect(toBundleKey(i.resolvedLanguage || i.language)).toBe('en')
    }
  })

  test('标准 BCP-47 标签也能归一化到受支持的 code', () => {
    // 调用方可能传 'zh-CN'：supportedLngs 里只有 'zhCN'，不归一化会被拦掉退回 en
    expect(toBundleKey('zh-CN')).toBe('zhCN')
    expect(toBundleKey('zh-TW')).toBe('zhTW')
    expect(toBundleKey('en-US')).toBe('en')
    expect(toBundleKey('fr-FR')).toBe('fr')
  })

  test('注入 zhCN 词条后，t() 能取到中文', async () => {
    const i = await initLike({ lng: 'zhCN' })
    expect(i.t('h')).toBe('Hi') // 注入前是英文兜底
    i.addResourceBundle('zhCN', 'translation', { h: '你好' }, true, true)
    expect(i.t('h')).toBe('你好')
  })
})
