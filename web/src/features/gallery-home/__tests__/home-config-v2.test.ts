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
 * HomeConfig v2（按语种分桶）测试
 * ------------------------------------------------------------------
 * 后台改文案时最容易踩的坑是「改了一种语言，全站都变成它」。
 * 这一组测试把迁移、回退链、共享优先级钉死：
 * - v1 旧配置迁进 locales.en，行为不变、不丢数据
 * - 某语种没填 → 回退英文 → 回退内置默认
 * - shared（视频/链接）永远盖过任何语种
 */

import { describe, expect, it } from 'vitest'

import {
  buildHomeData,
  buildMotionData,
  mergeHomeConfig,
  resolveHomeOverride,
} from '../data'
import { HOME_FALLBACK_LOCALE, HOME_LOCALES } from '../locales'
import { homeConfigV2Schema, normalizeHomeConfig } from '../schema'
import { INTERFACE_LANGUAGE_OPTIONS } from '../../../i18n/languages'

const identity = (k: string) => k

/** 模拟前台：默认 → 各覆盖层 → motion */
function render(cfg: unknown, lang: string) {
  const normalized = normalizeHomeConfig(cfg)
  let home = buildHomeData(identity)
  for (const layer of resolveHomeOverride(normalized, lang).layers) {
    home = mergeHomeConfig(home, layer)
  }
  return {
    home,
    motion: buildMotionData(identity, resolveHomeOverride(normalized, lang).motion),
  }
}

describe('normalizeHomeConfig', () => {
  it('moves a v1 override into the English bucket so nothing is lost', () => {
    const v1 = {
      hero: { title: '标题写死' },
      motion: { heroVideo: { videos: ['/videos/a.mp4'] } },
    }
    const out = normalizeHomeConfig(v1)
    expect(out.version).toBe(2)
    expect(out.locales?.[HOME_FALLBACK_LOCALE]).toMatchObject({ hero: { title: '标题写死' } })
    expect(out.shared?.motion?.heroVideo?.videos).toEqual(['/videos/a.mp4'])
  })

  it('passes a v2 config through untouched', () => {
    const v2 = {
      version: 2,
      locales: { en: { hero: { title: 'Imagine it.' } }, zhCN: { hero: { title: '想象一下' } } },
      shared: { motion: { heroVideo: { videos: ['/videos/a.mp4'] } } },
    }
    expect(normalizeHomeConfig(v2)).toMatchObject(v2)
  })

  it('never throws on junk, returns an empty v2 instead', () => {
    expect(normalizeHomeConfig(null)).toEqual({ version: 2, locales: {}, shared: {} })
    expect(normalizeHomeConfig('nope')).toEqual({ version: 2, locales: {}, shared: {} })
    expect(normalizeHomeConfig([])).toEqual({ version: 2, locales: {}, shared: {} })
  })

  it('drops invalid branches but keeps the rest', () => {
    const out = normalizeHomeConfig({
      hero: { title: 'ok' },
      motion: { heroVideo: { videos: 'not-an-array' } },
    })
    expect(out.locales?.en).toMatchObject({ hero: { title: 'ok' } })
    expect(out.shared?.motion?.heroVideo?.videos).toBeUndefined()
  })
})

describe('per-language overrides', () => {
  const cfg = {
    version: 2,
    locales: {
      en: { hero: { title: 'Imagine it.', subtitle: 'English sub' } },
      zhCN: { hero: { title: '想象一下' } },
    },
    shared: {},
  }

  it('renders the language own copy when it is filled', () => {
    expect(render(cfg, 'zhCN').home.hero.title).toBe('想象一下')
  })

  it('falls back to English for fields that language left empty', () => {
    expect(render(cfg, 'zhCN').home.hero.subtitle).toBe('English sub')
  })

  it('falls back to the built-in default when English has nothing either', () => {
    const { home } = render({ version: 2, locales: { zhCN: { hero: { title: '想象一下' } } } }, 'zhCN')
    expect(home.hero.subtitle).toBe(buildHomeData(identity).hero.subtitle)
  })

  it('treats an unknown language as English instead of breaking', () => {
    expect(render(cfg, 'klingon').home.hero.title).toBe('Imagine it.')
  })

  it('does not leak one language copy into another', () => {
    expect(render(cfg, 'ja').home.hero.title).toBe('Imagine it.')
    expect(render(cfg, 'en').home.hero.title).toBe('Imagine it.')
  })
})

describe('shared assets', () => {
  it('wins over any language layer (videos are the same everywhere)', () => {
    const cfg = {
      version: 2,
      locales: {
        en: { motion: { heroVideo: { videos: ['/videos/en-only.mp4'] } } },
        zhCN: { hero: { title: '想象一下' } },
      },
      shared: { motion: { heroVideo: { videos: ['/videos/shared.mp4'] } } },
    }
    expect(render(cfg, 'zhCN').motion.heroVideo.videos).toEqual(['/videos/shared.mp4'])
  })

  it('keeps per-language ticker text on top of shared motion config', () => {
    const cfg = {
      version: 2,
      locales: { zhCN: { motion: { heroTicker: { prefix: '上新' } } } },
      shared: { motion: { heroTicker: { durationSec: 60 } } },
    }
    const { motion } = render(cfg, 'zhCN')
    expect(motion.heroTicker.prefix).toBe('上新')
    expect(motion.heroTicker.durationSec).toBe(60)
  })

  it('plays any number of clips the admin configured', () => {
    const clips = Array.from({ length: 7 }, (_, i) => `/videos/clip-${i}.mp4`)
    const cfg = { version: 2, shared: { motion: { heroVideo: { videos: clips } } } }
    expect(render(cfg, 'en').motion.heroVideo.videos).toEqual(clips)
  })
})

describe('homeConfigV2Schema', () => {
  it('accepts an empty config (nothing configured yet)', () => {
    expect(homeConfigV2Schema.safeParse({}).success).toBe(true)
  })

  it('rejects a bucket that does not match the home data shape', () => {
    const bad = { version: 2, locales: { en: { hero: { title: 42 } } } }
    expect(homeConfigV2Schema.safeParse(bad).success).toBe(false)
  })

  it('rejects a wrong version literal', () => {
    expect(homeConfigV2Schema.safeParse({ version: 3 }).success).toBe(false)
  })
})

describe('locale list', () => {
  it('edits exactly the languages the site can switch to', () => {
    expect([...HOME_LOCALES].sort()).toEqual(
      INTERFACE_LANGUAGE_OPTIONS.map((o) => o.code).sort(),
    )
  })

  it('has English as the fallback', () => {
    expect(HOME_LOCALES).toContain(HOME_FALLBACK_LOCALE)
  })
})
