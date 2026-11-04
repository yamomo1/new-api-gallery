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
 * `@` 引用的触发判定（纯函数，无 React 依赖）
 * ------------------------------------------------------------------
 * 规则：从光标往前找最近的 `@`，只要它与光标之间没有空白、且字符数不超过
 * 上限，就认为正在输入引用 —— **不关心 `@` 前面是什么**。
 *
 * 为什么不再要求「`@` 前必须是空白/行首」：
 *   旧正则 `/(^|[\s(（])@([^\s@]{0,8})$/` 导致 `@图片1 AAA@`、`@@`、`AAA@`
 *   这些不带空格式分隔的场景全都弹不出候选面板（用户截图即此场景）。
 *   插入后的完整引用是 `@图片1 `（带尾空格），所以光标停在其后时
 *   最近的 `@` 与光标之间隔着空格 → 不会重复弹出，无需靠前缀限制来兜底。
 */

/** `@` 与光标之间允许的最大字符数（超过视为普通文本，避免长文本回溯） */
export const MAX_MENTION_QUERY = 16

/** 空白都算分隔符（`\s` 已含全角空格 \u3000） */
const isSeparator = (ch: string) => /\s/.test(ch)

export type MentionTrigger = {
  /** `@` 的下标（插入时从这里替换） */
  start: number
  /** 触发时的光标位置（插入时替换到这儿） */
  end: number
  /** `@` 与光标之间的内容，用于过滤 */
  query: string
}

/**
 * 从光标位置往前找最近的 `@`，判断是否处于「引用输入中」。
 *
 * 覆盖的场景：
 *   `@`              → query ''，弹全部
 *   `@图`            → query '图'，按标签过滤
 *   `AAA@`           → query ''，弹全部（旧规则弹不出来）
 *   `@图片1 AAA@`    → 命中最后那个 `@`
 *   `@@`             → 命中第二个 `@`
 *   `@图|片1`（光标居中）→ query '图'
 *   `@图片1 `（已插入）→ 中间有空格，不弹
 */
export function findMentionTrigger(
  text: string,
  caret: number
): MentionTrigger | null {
  const end = Math.max(0, Math.min(caret, text.length))
  let i = end - 1
  let distance = 0
  while (i >= 0) {
    const ch = text[i]
    if (ch === '@') {
      return { start: i, end, query: text.slice(i + 1, end) }
    }
    if (isSeparator(ch)) return null
    if (++distance > MAX_MENTION_QUERY) return null
    i -= 1
  }
  return null
}
