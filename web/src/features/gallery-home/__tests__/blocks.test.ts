/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied of MERCHANTABILITY or
FITNESS FOR A PARTICULAR PURPOSE. See the GNU Affero General Public
License for more details.

You should have received a copy of the GNU Affero General Public
License along with this program. If not, see <https://www.gnu.org/licenses/>.
*/
import { describe, expect, it } from 'vitest'

import { resolveHomeBlocks } from '../data'
import type { HomeConfigV2 } from '../schema'

describe('resolveHomeBlocks', () => {
  it('returns builtin order when config has no blocks', () => {
    const r = resolveHomeBlocks(null)
    expect(r.order).toEqual([
      'hero',
      'agent',
      'studios',
      'gallery',
      'models',
      'cta',
      'closing',
      'ticker',
    ])
    expect(r.hidden).toEqual({})
    expect(r.custom).toEqual({})
  })

  it('respects a custom order and flags hidden', () => {
    const cfg: HomeConfigV2 = {
      version: 2,
      blocks: {
        order: ['gallery', 'hero', 'agent'],
        hidden: { agent: true },
      },
    }
    const r = resolveHomeBlocks(cfg)
    expect(r.order).toEqual(['gallery', 'hero', 'agent'])
    expect(r.hidden).toEqual({ agent: true })
  })

  it('appends defined custom blocks that are missing from order', () => {
    const cfg: HomeConfigV2 = {
      version: 2,
      custom: { c1: { id: 'c1', kind: 'text', title: 'X' } },
      blocks: { order: ['hero', 'agent'] },
    }
    const r = resolveHomeBlocks(cfg)
    expect(r.order).toContain('c1')
    expect(r.order[r.order.length - 1]).toBe('c1')
    expect(r.custom.c1.title).toBe('X')
  })

  it('drops keys that are neither builtin nor custom', () => {
    const cfg: HomeConfigV2 = {
      version: 2,
      blocks: { order: ['hero', 'ghost', 'agent'] },
      custom: { c1: { id: 'c1', kind: 'text', title: 'Y' } },
    }
    const r = resolveHomeBlocks(cfg)
    expect(r.order).toEqual(['hero', 'agent', 'c1'])
  })

  it('drops an orphan custom id (in order but no custom value)', () => {
    const cfg: HomeConfigV2 = {
      version: 2,
      blocks: { order: ['hero', 'cOrphan', 'agent'] },
    }
    const r = resolveHomeBlocks(cfg)
    expect(r.order).toEqual(['hero', 'agent'])
  })
})
