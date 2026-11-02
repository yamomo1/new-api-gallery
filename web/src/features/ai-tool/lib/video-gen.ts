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
 * 视频生成（对接站内 /pg/videos）
 * ------------------------------------------------------------------
 * 视频与图片最大的不同：它是**异步任务**。
 *   提交  POST /pg/videos          → 立刻返回 task_id
 *   轮询  GET  /pg/videos/:task_id → queued / in_progress / completed / failed
 *
 * 请求体按 New API 任务插件的 openai_video 协议组织（豆包 Seedance 为准）：
 *   { model, prompt, seconds, images: [...], metadata: { resolution, ratio, content } }
 * 其余厂商插件（可灵 / 海螺 / Vidu / Veo…）读的是同一套字段，差异由插件吸收。
 */

import { api } from '@/lib/http-client'

export type VideoTaskStatus =
  | 'queued'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'unknown'

export type VideoGenInput = {
  model: string
  prompt: string
  /** 时长（秒） */
  seconds: number
  /** 画幅：'智能' 表示交给模型自己定 */
  ratio: string
  /** 480P / 720P / 1080P */
  quality: string
  /** 首帧图片地址（站内存储） */
  first?: string
  /** 尾帧图片地址 */
  last?: string
  /** 全能参考：图片素材（视频/音频暂未透传，见下方注释） */
  images?: string[]
}

export type VideoTaskSnapshot = {
  taskId: string
  status: VideoTaskStatus
  progress: number
  url?: string
  error?: string
}

type SubmitResponse = {
  success?: boolean
  message?: string
  // 任务插件提交成功后返回 OpenAI 风格对象
  id?: string
  task_id?: string
  data?: { id?: string; task_id?: string }
}

/**
 * 提交一次视频任务，返回 task_id。
 *
 * `images` 放首帧（或全能参考里的图片素材）；尾帧必须走 metadata.content 的
 * role=last_frame —— Ark 只认这个位置，放进 images 会被当成首帧。
 */
export async function submitVideo(input: VideoGenInput): Promise<string> {
  const images = [input.first, ...(input.images ?? [])].filter(
    (v): v is string => Boolean(v)
  )

  /**
   * 两套载荷：
   *
   * A. 带 metadata（豆包/火山 Ark 任务插件认这套：resolution、ratio、
   *    以及尾帧的 metadata.content[].role=last_frame）
   * B. 不带 metadata，尺寸放顶层 size（OpenAI 视频协议 / 多数中转只认
   *    model + prompt + seconds + size，遇到 metadata 会直接报
   *    "metadata is not an allowed request field"）
   *
   * 先发 A；如果上游明确说 metadata 不是允许字段，再降级发 B。
   * 尾帧只能靠 metadata 表达，所以降级时若带了尾帧就直接给出可读提示，
   * 不做「悄悄丢掉尾帧」这种事。
   */
  const buildBody = (withMetadata: boolean): Record<string, unknown> => {
    const body: Record<string, unknown> = {
      model: input.model,
      prompt: input.prompt,
      // OpenAI 视频接口的 seconds 是字符串（"8"），后端 DTO 也按 string 反序列化，
      // 传数字会直接 400（踩过：cannot unmarshal number into ... type string）
      seconds: String(input.seconds),
    }
    if (images.length) body.images = images

    if (withMetadata) {
      const metadata: Record<string, unknown> = {
        resolution: input.quality.toLowerCase(),
      }
      if (input.ratio && input.ratio !== '智能') metadata.ratio = input.ratio
      if (input.last) {
        metadata.content = [
          {
            type: 'image_url',
            image_url: { url: input.last },
            role: 'last_frame',
          },
        ]
      }
      body.metadata = metadata
    } else {
      body.size = resolveVideoSize(input.ratio, input.quality)
    }
    return body
  }

  const post = (body: Record<string, unknown>) =>
    api.post<SubmitResponse>('/pg/videos', body, {
      skipAuthRefresh: true,
      skipErrorHandler: true,
    })

  let res
  try {
    res = await post(buildBody(true))
  } catch (error) {
    const message = errorText(error)
    if (
      !/metadata/i.test(message) ||
      !/allowed|not allowed|unsupported/i.test(message)
    ) {
      throw error
    }
    if (input.last) {
      throw new Error(
        '当前渠道不接受尾帧参数（它会拒绝 metadata 字段），尾帧只能走支持豆包/火山（Ark）协议的任务插件渠道。可先改用「全能参考」模式，或把视频模型换到已绑定任务插件的渠道。'
      )
    }
    // 不带 metadata 重发：失败就原样抛错，别把真实原因吃掉
    res = await post(buildBody(false))
  }

  const payload = res.data
  const taskId =
    payload?.id ||
    payload?.task_id ||
    payload?.data?.id ||
    payload?.data?.task_id
  if (!taskId) {
    throw new Error(payload?.message || '提交视频任务失败：没有返回 task_id')
  }
  return taskId
}

/** 比例 + 清晰度 → 上游常见的 WxH（短边取 480/720/1080） */
export function resolveVideoSize(ratio: string, quality: string): string {
  const shortEdge: Record<string, number> = {
    '480P': 480,
    '720P': 720,
    '1080P': 1080,
  }
  const height = shortEdge[(quality || '720P').toUpperCase()] ?? 720
  const [rw, rh] =
    ratio && ratio !== '智能'
      ? ratio.split(':').map((n) => Number(n) || 0)
      : [16, 9]
  const width = Math.round((height * (rw || 16)) / (rh || 9) / 2) * 2
  return `${width}x${height}`
}

/** 从 axios / 后端错误里抠出可判断的文本 */
function errorText(error: unknown): string {
  const anyError = error as {
    response?: {
      data?: {
        message?: string
        error?: { message?: string }
        data?: { message?: string }
      }
    }
    message?: string
  }
  const data = anyError.response?.data
  return (
    data?.data?.message ||
    data?.error?.message ||
    data?.message ||
    anyError.message ||
    ''
  )
}

/** 查一次任务状态（后台每 3 秒调一次，不会打到上游） */
export async function fetchVideoTask(
  taskId: string
): Promise<VideoTaskSnapshot> {
  const res = await api.get<{
    success?: boolean
    message?: string
    data?: {
      task_id?: string
      status?: VideoTaskStatus
      progress?: string
      url?: string
      error?: string
    }
  }>(`/pg/videos/${encodeURIComponent(taskId)}`, {
    skipAuthRefresh: true,
    skipErrorHandler: true,
  })
  const payload = res.data
  if (!payload?.success || !payload.data) {
    throw new Error(payload?.message || '查询任务失败')
  }
  const raw = payload.data
  return {
    taskId: raw.task_id || taskId,
    status: (raw.status as VideoTaskStatus) || 'unknown',
    progress: Number(String(raw.progress ?? '0').replace('%', '')) || 0,
    url: raw.url,
    error: raw.error,
  }
}

/**
 * 轮询直到结束。
 *
 * 失败/超时都由调用方决定怎么展示，这里只负责按时收尾：
 * - 每 3 秒一次，最长 15 分钟（Seedance 2.5 30s 片源 + 排队也够）
 * - signal 中断立即停止（用户切页/重新提交时不要留着定时器）
 */
export async function pollVideoTask(
  taskId: string,
  onTick: (snapshot: VideoTaskSnapshot) => void,
  signal?: AbortSignal
): Promise<VideoTaskSnapshot> {
  const deadline = Date.now() + 15 * 60 * 1000
  let last: VideoTaskSnapshot = {
    taskId,
    status: 'queued',
    progress: 0,
  }

  while (Date.now() < deadline) {
    if (signal?.aborted) return last
    try {
      last = await fetchVideoTask(taskId)
    } catch (error) {
      // 单次查询失败不终止轮询：网络抖动很常见，任务本身还在跑
      last = { ...last, error: (error as Error).message }
    }
    onTick(last)
    if (last.status === 'completed' || last.status === 'failed') return last
    await new Promise((resolve) => setTimeout(resolve, 3000))
  }
  return {
    ...last,
    status: last.status === 'completed' ? 'completed' : 'failed',
    error: last.error || '任务超时，请稍后到「任务」页查看结果',
  }
}
