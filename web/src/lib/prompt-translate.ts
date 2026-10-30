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
 * 提示词自动翻译（客户端）
 * ------------------------------------------------------------------
 * 这里只做三件事：拿配额、发请求、清洗结果。
 * **所有策略都在服务端** —— 约束大模型的提示词、用哪个模型、每天几次、
 * 超出后扣多少额度，统统由 `/pg/translate` 决定（后台「翻译设置」可改）。
 *
 * 曾经这套逻辑全在前端：提示词写死在代码里、自己挑模型、前端无从限制次数。
 * 后果是管理员改个提示词要发版，用户可以无限白嫖翻译额度。
 * 现在前端退化成一个薄壳，改策略不再需要动这里。
 */
import { api } from '@/lib/api'

/** 配额与规则，由 `/api/gallery-translate/status` 返回 */
export type TranslateStatus = {
  enabled: boolean
  /** 后台指定的模型名；空串表示由后端自动挑 */
  model: string
  /** 每日免费次数，0 表示不限 */
  dailyLimit: number
  used: number
  /** 剩余次数，-1 表示不限 */
  remaining: number
  /** 超出后是否允许花钱继续 */
  overageEnabled: boolean
  /** 超出后每次扣多少额度（1 quota = 1/500000 美元时的单位） */
  overageQuota: number
  maxChars: number
  /** 管理员自定义的前台规则文案 */
  notice: string
  /** 当前用户额度余额（仅在需要付费展示时有值） */
  quota: number
  quotaPerUnit: number
}

/** 翻译成功的结果 */
export type TranslateResult = {
  text: string
  /** 本次是否消耗了额度（超出免费次数） */
  charged: boolean
  /** 本次之后剩余次数，-1 表示不限 */
  remaining: number
}

/** 失败时抛出的错误，message 是给 i18n 用的 key */
export class TranslateError extends Error {
  /** 机器可读的失败原因 */
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.name = 'TranslateError'
    this.code = code
  }
}

type ChatCompletionResponse = {
  choices?: Array<{ message?: { content?: string } }>
  error?: { message?: string }
}

/**
 * 拿当前用户的配额与规则。
 *
 * 失败了不要抛 —— 配额展示是锦上添花的事，
 * 拿不到就当「不限量」，别因此让整个投稿表单不可用。
 */
export async function getTranslateStatus(signal?: AbortSignal): Promise<TranslateStatus | null> {
  try {
    const res = await api.get<{ success: boolean; data?: TranslateStatus }>(
      '/api/gallery-translate/status',
      { signal }
    )
    return res.data?.data ?? null
  } catch {
    return null
  }
}

/**
 * 把一段中文提示词翻成英文。
 *
 * @param prompt 待翻译的提示词
 * @param signal 用于取消（用户关弹窗时中断请求）
 * @throws TranslateError 次数用尽 / 额度不足 / 未配置渠道等
 */
export async function translatePromptToEnglish(
  prompt: string,
  signal?: AbortSignal
): Promise<TranslateResult> {
  const text = prompt.trim()
  if (!text) throw new TranslateError('empty', 'translate.empty_input')
  // 纯 ASCII 大概率本来就是英文，没必要花一次调用
  if (!/[\u4e00-\u9fa5]/.test(text)) {
    return { text, charged: false, remaining: -1 }
  }

  let res
  try {
    res = await api.post<ChatCompletionResponse>('/pg/translate', { text }, { signal })
  } catch (error) {
    throw toTranslateError(error)
  }

  // 服务端要把写在 response header 里的用量信息传过来（避免改动返回体结构）
  const charged = res.headers?.['x-translate-charged'] === '1'
  const remainingHeader = res.headers?.['x-translate-remaining']
  const remaining = remainingHeader !== undefined ? Number(remainingHeader) : -1

  const content = res.data?.choices?.[0]?.message?.content
  const cleaned = sanitizeTranslation(content)
  if (!cleaned) {
    throw new TranslateError('bad_response', 'translate.failed')
  }
  return { text: cleaned, charged, remaining }
}

/**
 * 兜底清洗：个别模型无视 system 指令仍会"说话"
 * （自我介绍 / "Here is the translation" 等对话文本），
 * 这类输出绝不能落进英文提示词字段。
 */
const CHAT_REPLY_PATTERNS = [
  /^I am\b/i,
  /^I'm\b/i,
  /^(Sure|Of course|Certainly|Okay|OK)[,!]/i,
  /^Here (is|'s)\b/i,
  /^(This is|That is) the translation/i,
  /^我是/,
  /^(你好|您好)[!！。,，]/,
  /^以下是|^翻译如下|^译文[:：]/,
  /<translate>|<\/translate>/i,
]

function sanitizeTranslation(content: string | undefined): string | null {
  if (!content) return null
  let text = content.trim()
  // 剥一层包裹引号（模型爱给翻译加引号）
  if (
    (text.startsWith('"') && text.endsWith('"')) ||
    (text.startsWith('“') && text.endsWith('”'))
  ) {
    text = text.slice(1, -1).trim()
  }
  if (!text) return null
  if (CHAT_REPLY_PATTERNS.some((re) => re.test(text))) return null
  return text
}

/**
 * 允许直接弹给用户看的 i18n key。
 *
 * 服务端还会返回一些纯内部的机器码（已改成统一走日志），这里设白名单兜一层：
 * 未知的 `translate.*` 一律降级成通用失败文案，绝不能把英文 key 原样弹出去。
 */
const USER_FACING_CODES = new Set([
  'translate.limited',
  'translate.need_quota',
  'translate.disabled',
  'translate.no_model',
  'translate.empty_input',
  'translate.invalid_input',
  'translate.failed',
])

/** 把 axios 错误翻译成统一的 TranslateError */
function toTranslateError(error: unknown): TranslateError {
  const status = (error as { response?: { status?: number } })?.response?.status
  const body = (error as { response?: { data?: { message?: string } } })?.response?.data
  const code = typeof body?.message === 'string' ? body.message : ''

  // 服务端返回用户可读的 i18n key 时直接沿用
  if (USER_FACING_CODES.has(code)) {
    return new TranslateError(code, code)
  }
  // 兜底：按 HTTP 状态推断
  if (status === 429) return new TranslateError('limited', 'translate.limited')
  if (status === 402) return new TranslateError('need_quota', 'translate.need_quota')
  if (status === 403) return new TranslateError('disabled', 'translate.disabled')
  if (status === 400) return new TranslateError('no_model', 'translate.no_model')
  return new TranslateError('failed', 'translate.failed')
}
