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
 * 组件级回归：MentionTextarea 在各种输入形态下是否会弹面板。
 * 纯函数规则见同目录 mention-trigger.test.ts。
 */
import { fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'

import { MentionTextarea, type MentionItem } from '../mention'

const ITEMS: MentionItem[] = [
  { key: 'a', label: '图片1', type: 'image' },
  { key: 'b', label: '图片2', type: 'image' },
]

function Harness({ initial = '' }: { initial?: string }) {
  const [value, setValue] = useState(initial)
  return (
    <div>
      <MentionTextarea value={value} onChange={setValue} items={ITEMS} />
      <output data-testid='value'>{value}</output>
    </div>
  )
}

const menu = () => document.querySelector('[data-mention-menu]')

/** 模拟一次输入：整段替换并把光标放到末尾（等价于逐字输入到结尾） */
const type = (next: string) => {
  const ta = screen.getByRole('textbox') as HTMLTextAreaElement
  fireEvent.change(ta, { target: { value: next } })
  return ta
}

describe('MentionTextarea', () => {
  it('输入 @ 就弹出候选面板', () => {
    render(<Harness />)
    type('@')
    expect(menu()).not.toBeNull()
    expect(within(menu() as HTMLElement).getByText('图片1')).toBeTruthy()
    expect(within(menu() as HTMLElement).getByText('图片2')).toBeTruthy()
  })

  it('@ 前面不是空格也能弹（AAA@）', () => {
    render(<Harness />)
    type('AAA@')
    expect(menu()).not.toBeNull()
  })

  it('连续多个 @ 仍能弹（@@）', () => {
    render(<Harness />)
    type('@@')
    expect(menu()).not.toBeNull()
  })

  it('截图场景：@图片1 AAA@ 的第二个 @ 能弹', () => {
    render(<Harness />)
    type('@图片1 AAA@')
    expect(menu()).not.toBeNull()
    expect(within(menu() as HTMLElement).getByText('图片1')).toBeTruthy()
  })

  it('@ 后紧跟文字按编号过滤', () => {
    render(<Harness />)
    type('@2')
    const el = menu() as HTMLElement
    expect(within(el).getByText('图片2')).toBeTruthy()
    expect(within(el).queryByText('图片1')).toBeNull()
  })

  it('引用写完（@图片1 加空格）后面板收起', () => {
    render(<Harness />)
    const ta = type('@图片1')
    expect(menu()).not.toBeNull()
    fireEvent.change(ta, { target: { value: '@图片1 ' } })
    expect(menu()).toBeNull()
  })

  it('点击候选项插入完整引用并只替换当前 @ 段', () => {
    render(<Harness />)
    type('@图片1 AAA@')
    const el = menu() as HTMLElement
    fireEvent.mouseDown(within(el).getByText('图片2'))
    expect(screen.getByTestId('value').textContent).toBe('@图片1 AAA@图片2 ')
  })

  it('回车插入当前高亮项，Esc 关闭面板', () => {
    render(<Harness />)
    const ta = type('@')
    fireEvent.keyDown(ta, { key: 'ArrowDown' })
    fireEvent.keyDown(ta, { key: 'Enter' })
    expect(screen.getByTestId('value').textContent).toBe('@图片2 ')

    const ta2 = type('@')
    fireEvent.keyDown(ta2, { key: 'Escape' })
    expect(menu()).toBeNull()
  })

  it('没有素材时不弹面板', () => {
    function Empty() {
      const [value, setValue] = useState('')
      return <MentionTextarea value={value} onChange={setValue} items={[]} />
    }
    render(<Empty />)
    type('@')
    expect(menu()).toBeNull()
  })
})
