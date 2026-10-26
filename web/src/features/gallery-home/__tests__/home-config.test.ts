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
 * 首页数据层冒烟测试
 * 覆盖：默认值本地化、后台覆盖深合并、首屏视频任意段数、HomeConfig 校验。
 * 目的：rebase 上游或改动后台配置结构时第一时间暴露问题。
 */

import { describe, expect, it } from 'vitest'

import { buildHomeData, buildMotionData, mergeHomeConfig } from '../data'
import { parseHomeConfig } from '../schema'

const identity = (k: string) => k

describe('buildHomeData', () => {
  it('applies the translator to copy but leaves paths and literals alone', () => {
    const data = buildHomeData((k) => (k === 'Imagine it.' ? 'TRANSLATED' : k))
    expect(data.hero.title).toBe('TRANSLATED')
    expect(data.hero.card.images[0]).toBe('/images/home/model-image-v4.webp')
    expect(data.hero.colors.screenBg).toBe('#030b0f')
    expect(data.models.items[0].name).toBe('Seedance 2.5')
  })

  it('keeps section indices and section structure intact', () => {
    const data = buildHomeData(identity)
    expect(data.agent.index).toBe('01')
    expect(data.agent.skills).toHaveLength(6)
    expect(data.agent.features).toHaveLength(4)
    expect(data.gallery.items.length).toBeGreaterThan(0)
  })
})

describe('buildMotionData', () => {
  it('falls back to the built-in playlist when nothing is configured', () => {
    const motion = buildMotionData(identity, null)
    expect(motion.heroVideo.videos.length).toBeGreaterThanOrEqual(2)
  })

  it('plays whatever number of clips the admin configured, in order', () => {
    const clips = Array.from({ length: 5 }, (_, i) => `/videos/clip-${i}.mp4`)
    const motion = buildMotionData(identity, { heroVideo: { videos: clips } })
    expect(motion.heroVideo.videos).toEqual(clips)
  })

  it('drops empty entries so <video src> never receives ""', () => {
    const motion = buildMotionData(identity, {
      heroVideo: { videos: ['/videos/a.mp4', '', '   '] },
    })
    expect(motion.heroVideo.videos).toEqual(['/videos/a.mp4'])
  })
})

describe('mergeHomeConfig', () => {
  it('deep merges objects and replaces arrays/strings wholesale', () => {
    const base = buildHomeData(identity)
    const merged = mergeHomeConfig(base, {
      hero: { primaryLabel: 'Try it' },
      agent: { features: [{ icon: 'Sparkles', title: 'One', desc: 'Two' }] },
    })
    expect(merged.hero.primaryLabel).toBe('Try it')
    expect(merged.hero.subtitle).toBe(base.hero.subtitle)
    expect(merged.agent.features).toHaveLength(1)
  })

  it('ignores empty and unknown-values so defaults survive', () => {
    const base = buildHomeData(identity)
    const merged = mergeHomeConfig(base, { hero: { primaryLabel: '' } })
    expect(merged.hero.primaryLabel).toBe(base.hero.primaryLabel)
  })
})

describe('parseHomeConfig', () => {
  it('accepts a valid config', () => {
    const parsed = parseHomeConfig({ hero: { primaryLabel: 'Go' } })
    expect(parsed?.hero?.primaryLabel).toBe('Go')
  })

  it('returns null instead of throwing on malformed input', () => {
    expect(parseHomeConfig(null)).toBeNull()
    expect(parseHomeConfig('nope')).toBeNull()
    expect(parseHomeConfig({ hero: { metaLabels: 'not-an-array' } })).toBeNull()
  })

  it('keeps unknown sections so older configs still work', () => {
    const parsed = parseHomeConfig({ someFutureSection: { keep: true } })
    expect(parsed).not.toBeNull()
    expect((parsed as Record<string, unknown>).someFutureSection).toEqual({ keep: true })
  })
})
