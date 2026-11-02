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
 * 参考图 → 内联数据 URL（data:image/xxx;base64,...）
 * ------------------------------------------------------------------
 * 为什么不用「先上传再传 URL」：
 * 图生图的上游绝大多数要求 `image` 是 base64 或**它自己能访问的公网地址**。
 * 我们上传得到的地址在以下几种情况对上游不可达 —— 本机/内网调试、未备案域名、
 * 对象存储防盗链、签名过期 —— 上游拿不到就会把整个字符串当 base64 解，
 * 报 "image is not a valid image base64"（真实踩过）。
 *
 * 内联 base64 不依赖上游网络，是各家 API 的公共分母（Ark / DashScope /
 * 硅基流动 / 各类中转都收）。代价是请求体变大，所以这里做了压缩。
 */

/** 单张内联上限：base64 后约 1.75 倍，留出多图与 JSON 的余量 */
const INLINE_MAX_BYTES = 2.2 * 1024 * 1024
/** 长边上限：主流出图模型参考图 1K~2K 足够，再大只是浪费 token 与带宽 */
const MAX_EDGE = 1536

const RAW_PASSTHROUGH_BYTES = 1.2 * 1024 * 1024
const PASSTHROUGH_TYPES = ['image/jpeg', 'image/png', 'image/webp']

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error('读取图片失败'))
    reader.readAsDataURL(file)
  })
}

function loadImageElement(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('图片解码失败'))
    img.src = url
  })
}

/** 等比缩放到长边不超过 maxEdge，并编码为 JPEG */
async function reencode(
  file: Blob,
  maxEdge: number,
  quality: number
): Promise<string> {
  const objectUrl = URL.createObjectURL(file)
  try {
    const img = await loadImageElement(objectUrl)
    const longest = Math.max(img.naturalWidth, img.naturalHeight) || maxEdge
    const scale = Math.min(1, maxEdge / longest)
    const width = Math.max(1, Math.round(img.naturalWidth * scale))
    const height = Math.max(1, Math.round(img.naturalHeight * scale))

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('浏览器不支持 Canvas')
    // JPEG 没有 alpha，先铺白底，避免透明区变黑
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
    ctx.drawImage(img, 0, 0, width, height)
    return canvas.toDataURL('image/jpeg', quality)
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

/**
 * 把用户选的图片转成可直接放进 `image` 字段的数据 URL。
 *
 * 小图（≤1.2MB 且 jpeg/png/webp）原样透传，不做二次编码 —— 避免把用户
 * 已经压好的图再糊一次；大图按长边 1536 / JPEG 0.88 压。压完仍超标就
 * 继续降到 1024 / 0.78。
 */
export async function fileToInlineImage(file: File): Promise<string> {
  try {
    if (
      file.size <= RAW_PASSTHROUGH_BYTES &&
      PASSTHROUGH_TYPES.includes(file.type)
    ) {
      return await readAsDataUrl(file)
    }
    let dataUrl = await reencode(file, MAX_EDGE, 0.88)
    if (dataUrl.length * 0.75 > INLINE_MAX_BYTES) {
      dataUrl = await reencode(file, 1024, 0.78)
    }
    return dataUrl
  } catch {
    // 兜底：宁可原样传（大但合法），也不要因为压缩失败而丢掉参考图
    return readAsDataUrl(file)
  }
}

/** 粗略估算 data URL 的字节数（base64 段 × 0.75） */
export function inlineImageBytes(dataUrl: string): number {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
  return Math.round(base64.length * 0.75)
}
