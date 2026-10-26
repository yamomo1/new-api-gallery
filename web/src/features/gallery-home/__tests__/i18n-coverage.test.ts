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
 * 首页 + 后台多语种覆盖测试
 * ------------------------------------------------------------------
 * 约定：data.ts 里的英文原文就是 i18n key，所以「所有可翻译字符串」
 * 必须在每一份 locale 里都有译文（英文自身除外，缺失时回退 key 也算通过）。
 * 一旦有人在 data.ts 加了文案却忘了补译文，这个测试会直接失败。
 */

import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { collectStrings, HOME_DATA, MOTION_DATA } from '../data'
import { FIELD_GROUPS } from '../../home-settings/field-groups'

const LOCALES_DIR = path.resolve(__dirname, '../../../i18n/locales')
const TRANSLATED_LOCALES = ['zh', 'zh-TW', 'ja', 'fr', 'ru', 'vi']

type Translations = Record<string, unknown>

function loadTranslations(locale: string): Translations {
  const raw = fs.readFileSync(path.join(LOCALES_DIR, `${locale}.json`), 'utf8')
  return (JSON.parse(raw) as { translation: Translations }).translation
}

/** 收集所有需要在语言包里出现的原文（复用 data.ts 的同一套遍历规则） */
function collectCopyKeys(): Set<string> {
  const keys = new Set<string>()
  // 首页默认数据 + 动效配置
  for (const k of collectStrings(HOME_DATA)) keys.add(k)
  for (const k of collectStrings(MOTION_DATA)) keys.add(k)
  // 后台设置表单的分组名与字段名
  for (const group of FIELD_GROUPS) {
    keys.add(group.title)
    group.fields.forEach((f) => keys.add(f.label))
  }
  return keys
}

describe('gallery home i18n coverage', () => {
  const copyKeys = [...collectCopyKeys()]

  it('finds the expected number of translatable strings', () => {
    expect(copyKeys.length).toBeGreaterThan(80)
  })

  it.each(TRANSLATED_LOCALES)('%s translates every homepage string', (locale) => {
    const dict = loadTranslations(locale)
    const missing = copyKeys.filter((key) => typeof dict[key] !== 'string')
    expect(
      missing,
      `${locale}.json 缺少 ${missing.length} 条译文（英文原文即 key）`
    ).toEqual([])
  })

  it.each(TRANSLATED_LOCALES)('%s has no empty translations', (locale) => {
    const dict = loadTranslations(locale)
    const empty = copyKeys.filter(
      (key) => typeof dict[key] === 'string' && dict[key] === ''
    )
    expect(empty).toEqual([])
  })
})
