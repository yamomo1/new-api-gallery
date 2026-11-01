/*
 * 图片生成（对接站内 /pg/images/generations）
 * ------------------------------------------------------------------
 * 为什么不是 /v1/images/generations：/v1 整组走令牌鉴权（只认 sk- API 令牌），
 * 登录会话的 access token 会被判「无效的令牌」。/pg 前缀是后端的 playground
 * 语义（UserAuth + Distribute），按登录用户额度计费 —— 站点创作页正是这个场景。
 *
 * 尺寸口径：清晰度决定长边（1K=1024 / 2K=1536），比例决定宽高，
 * 结果对齐到 16 的倍数（多数国内模型对任意尺寸都能接受，但不规整的值容易报错）。
 */
import { api } from '@/lib/http-client'

export type ImageGenInput = {
  model: string
  prompt: string
  ratio: string
  clarity: string
  count: number
  quality?: string
  /** 参考图（data URL / 外链）。当前后端不一定消费，先透传 */
  images?: string[]
}

export type ImageGenOutput = {
  urls: string[]
  size: string
  model: string
  ratio: string
}

/** 比例 + 清晰度 → 像素尺寸 */
export function resolveSize(ratio: string, clarity: string) {
  const longEdge = clarity === '2K' ? 1536 : 1024
  const [w, h] = ratio.split(':').map((n) => Number(n) || 1)
  const scale = longEdge / Math.max(w, h)
  const round16 = (v: number) => Math.max(256, Math.round(v / 16) * 16)
  return {
    width: round16(w * scale),
    height: round16(h * scale),
    label: `${round16(w * scale)}x${round16(h * scale)}`,
  }
}

type OpenAIImageResponse = {
  data?: Array<{ url?: string; b64_json?: string }>
  error?: { message?: string }
  message?: string
}

/** 调一次文生图，返回可直接渲染的图片地址（url 或 data URI） */
export async function generateImages(
  input: ImageGenInput,
  signal?: AbortSignal
): Promise<ImageGenOutput> {
  const { label } = resolveSize(input.ratio, input.clarity)
  const body: Record<string, unknown> = {
    model: input.model,
    prompt: input.prompt,
    n: Math.max(1, Math.min(4, input.count)),
    size: label,
  }
  if (input.quality === 'Pro') body.quality = 'hd'
  if (input.images?.length) body.image = input.images

  let res
  try {
    res = await api.post<OpenAIImageResponse>('/pg/images/generations', body, {
      signal,
      // 生成失败只在卡片里提示，不要触发全局 401 跳登录页
      skipAuthRefresh: true,
      skipErrorHandler: true,
    })
  } catch (error) {
    throw new Error(readError(error))
  }

  const payload = res.data
  const urls = (payload?.data ?? [])
    .map((item) =>
      item?.url
        ? item.url
        : item?.b64_json
          ? `data:image/png;base64,${item.b64_json}`
          : ''
    )
    .filter(Boolean)

  if (!urls.length) {
    throw new Error(
      payload?.error?.message || payload?.message || '模型没有返回图片'
    )
  }
  return { urls, size: label, model: input.model, ratio: input.ratio }
}

/** 把 axios / 后端错误压成一句人话 */
function readError(error: unknown): string {
  const anyError = error as {
    response?: { status?: number; data?: { message?: string; error?: { message?: string } } }
    message?: string
  }
  const serverMessage =
    anyError.response?.data?.error?.message ||
    anyError.response?.data?.message ||
    anyError.message
  const status = anyError.response?.status
  if (status === 401) return '请先登录后再生成'
  if (status === 402) return '额度不足，请先充值'
  if (status === 429) return '请求过于频繁，请稍后再试'
  return serverMessage || '生成失败，请稍后再试'
}
