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

import { describe, expect, it } from 'vitest'

import { findMentionTrigger } from '../lib/mention-trigger'

/** 便捷断言：`|` 标记光标位置 */
const at = (raw: string) => {
  const caret = raw.indexOf('|')
  const text = raw.replace('|', '')
  return findMentionTrigger(text, caret === -1 ? text.length : caret)
}

describe('findMentionTrigger', () => {
  it('行首单独一个 @ 就触发，query 为空', () => {
    expect(at('@|')).toEqual({ start: 0, end: 1, query: '' })
  })

  it('@ 后紧跟文字时按 query 过滤', () => {
    expect(at('@图|')).toEqual({ start: 0, end: 2, query: '图' })
    expect(at('@图片1|')).toEqual({ start: 0, end: 4, query: '图片1' })
  })

  it('@ 前面不是空白也要触发（旧规则的核心缺陷）', () => {
    // 截图里的场景：@图片1 AAA@
    expect(at('@图片1 AAA@|')).toEqual({ start: 8, end: 9, query: '' })
    expect(at('AAA@|')).toEqual({ start: 3, end: 4, query: '' })
    expect(at('文字@|')).toEqual({ start: 2, end: 3, query: '' })
  })

  it('连续多个 @ 命中最近的那个', () => {
    expect(at('@@|')).toEqual({ start: 1, end: 2, query: '' })
    expect(at('@@@|')).toEqual({ start: 2, end: 3, query: '' })
  })

  it('光标停在 @ 与已有文字中间也能触发', () => {
    expect(at('@|图片1')).toEqual({ start: 0, end: 1, query: '' })
    expect(at('@图|片1')).toEqual({ start: 0, end: 2, query: '图' })
    expect(at('AAA@图|片1')).toEqual({ start: 3, end: 5, query: '图' })
  })

  it('@ 与光标之间出现空白就不再触发（已插入的引用不会重复弹）', () => {
    expect(at('@图片1 |')).toBeNull()
    // 光标停在空格之后（离开引用输入区）
    expect(at('@ |图片1')).toBeNull()
    expect(at('@图片1 AAA|')).toBeNull()
    // 换行同理
    expect(at('@图片1\n|')).toBeNull()
  })

  it('普通文本不触发', () => {
    expect(at('|')).toBeNull()
    expect(at('hello world|')).toBeNull()
    expect(at('没有艾特符号|')).toBeNull()
  })

  it('query 超长视为普通文本，避免长文本回溯', () => {
    expect(at(`${'@'}${'a'.repeat(16)}|`)).not.toBeNull()
    expect(at(`${'@'}${'a'.repeat(17)}|`)).toBeNull()
  })

  it('光标越界时按文本长度收敛', () => {
    const text = 'AAA@'
    expect(findMentionTrigger(text, 999)).toEqual({
      start: 3,
      end: 4,
      query: '',
    })
    expect(findMentionTrigger(text, -5)).toBeNull()
  })
})
