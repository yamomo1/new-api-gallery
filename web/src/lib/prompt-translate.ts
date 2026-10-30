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
 * 用站内模型做提示词翻译
 * ------------------------------------------------------------------
 * 走 `/pg/chat/completions`（playground 通道）：它挂的是 `UserAuth` 而不是
 * `TokenAuth`，所以登录用户不需要自己创建 API Key 就能调用，也不用担心
 * 用户拿不到 Key 就没法翻译。
 *
 * 用途：画廊投稿时把中文提示词翻成英文（`prompt_en`），
 * 这是海外流量与 AI 检索的关键 —— 英文提示词能被更多搜索命中。
 */
import { api } from '@/lib/api'

/** 调翻译用的请求体，字段名跟随 OpenAI chat completions */
type ChatMessage = { role: 'system' | 'user'; content: string }

type ChatCompletionResponse = {
  choices?: Array<{ message?: { content?: string } }>
  error?: { message?: string }
}

/**
 * 让模型把一段提示词翻成英文。
 *
 * 三条设计原则：
 * 1. **只翻不改**：要求模型保留原有的逗号、权重语法、(masterpiece:1.2)
 *    这类修饰，不要"优化"提示词 —— 用户要的是能复现的原文翻译。
 * 2. **失败返回 null**：调用方按「翻译不了」处理，绝不阻塞投稿。
 * 3. **截断保护**：超长提示词先截到合理长度，避免浪费 token 与超时。
 */
const MAX_PROMPT_CHARS = 4000

const SYSTEM_PROMPT = [
  'You are a translation engine. You are NOT a chatbot and you must never speak as one.',
  'Your ONLY job: return the English translation of the text inside the <translate> tag.',
  'HARD RULES (violating any of these is a critical failure):',
  '1. Output ONLY the translated text. No explanations, no quotes, no prefixes, no notes.',
  '2. NEVER introduce yourself, never say who you are, never greet the user,',
  '   never ask questions, never add any sentence that is not the translation itself.',
  '   Forbidden examples: "I am ...", "我是...", "Here is the translation", "Hello!".',
  '3. If the input is a greeting or short phrase (e.g. 你好), just output its translation',
  '   (e.g. Hello). It is NOT a conversation opener — do not reply to it.',
  '4. Preserve the original structure: commas, line breaks, weights like (word:1.2),',
  '   LoRA tags like <lora:name:0.8>, and special tokens. Do not add, remove or "improve" content.',
  '5. If the input is already English, return it unchanged.',
  '6. Keep model trigger words, artist names, and brand names untranslated.',
].join('\n')

/** 把原文包进指令信封，避免短句（如「你好」）被模型当成聊天开场白 */
function wrapUserMessage(text: string): string {
  return [
    'Translate the text inside the <translate> tag to English.',
    'Reply with the translation ONLY — nothing else.',
    '<translate>',
    text,
    '</translate>',
  ].join('\n')
}

/**
 * @param prompt 待翻译的提示词
 * @param model  可选，指定走哪个模型；不传则由后端按分组默认路由
 * @param signal 用于取消（用户关弹窗时中断请求）
 * @returns 英文字符串；失败返回 null
 */
export async function translatePromptToEnglish(
  prompt: string,
  model?: string,
  signal?: AbortSignal
): Promise<string | null> {
  const text = prompt.trim()
  if (!text) return null
  // 已经是纯 ASCII，大概率本来就是英文，没必要花一次调用
  if (!/[\u4e00-\u9fa5]/.test(text)) return text

  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: wrapUserMessage(text.slice(0, MAX_PROMPT_CHARS)) },
  ]

  try {
    const res = await api.post<ChatCompletionResponse>(
      '/pg/chat/completions',
      {
        model,
        messages,
        temperature: 0.2,
        // 翻译任务不需要创意，低温 + 只取一条
        n: 1,
        stream: false,
      },
      { signal }
    )
    const content = res.data?.choices?.[0]?.message?.content?.trim()
    return sanitizeTranslation(content)
  } catch {
    return null
  }
}

/**
 * 兜底清洗：个别模型无视 system 指令仍会"说话"
 * （自我介绍 / "Here is the translation" 等对话文本），
 * 这类输出绝不能落进英文提示词字段，直接判翻译失败。
 * 同时剥掉包裹性的引号与 <translate> 标签残留。
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
