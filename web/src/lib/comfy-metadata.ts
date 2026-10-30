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
 * ComfyUI / Stable Diffusion PNG 元数据提取
 * ------------------------------------------------------------------
 * ComfyUI 保存图片时会把整张节点图写进 PNG 的 tEXt 块（key = "prompt" 与
 * "workflow"）。WebUI 系则写在 "parameters" 里。投稿时把这些字段自动读出来
 * 填进表单，用户就不用回 ComfyUI 界面手动抄几百字提示词 —— 那是投稿环节
 * 最大的流失点。
 *
 * 设计原则：
 * 1. **绝不抛错**。解析失败返回 null，调用方当「没识别出来」处理即可。
 * 2. **不上传、不联网**。只读文件头几个字节的 tEXt 块，不解码像素。
 * 3. **宽松**。各家工作流结构千奇百怪，认不出来就留空。
 */

/** 解析结果，字段全部可选 —— 一个字段都没认出来时返回 null */
export interface ComfyGenerationMeta {
  /** 正向提示词 */
  prompt?: string
  /** 负向提示词 */
  negativePrompt?: string
  /** 底模文件名（去掉 .safetensors 后缀） */
  model?: string
  /** 用到的 LoRA 名，可能多个 */
  loras?: string[]
  /** 采样器名，如 euler / dpmpp_2m */
  sampler?: string
  /** 采样步数 */
  steps?: number
  /** CFG scale */
  cfg?: number
  /** 随机种子 */
  seed?: number
  /** 图片宽高 */
  width?: number
  height?: number
  /** 元数据来源，便于 UI 提示用户「从 ComfyUI 工作流识别」 */
  source: 'comfyui' | 'a1111'
}

/* ------------------------------------------------------------------ */
/* PNG tEXt 块读取                                                     */
/* ------------------------------------------------------------------ */

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

/** 只读文件前 8MB 就够：tEXt 一定在 IDAT 之前，而 IDAT 前面通常只有几十 KB */
const MAX_HEADER_BYTES = 8 * 1024 * 1024

function isPng(bytes: Uint8Array): boolean {
  if (bytes.length < 8) return false
  return PNG_SIGNATURE.every((b, i) => bytes[i] === b)
}

/**
 * 从 PNG 里取出所有 tEXt / zTXt / iTXt 块。
 * ComfyUI 用的是 tEXt（未压缩），兼容 zTXt 是顺手的事。
 */
async function readPngTextChunks(
  file: File
): Promise<Record<string, string>> {
  const head = new Uint8Array(
    await file.slice(0, Math.min(file.size, MAX_HEADER_BYTES)).arrayBuffer()
  )
  if (!isPng(head)) return {}

  const out: Record<string, string> = {}
  const view = new DataView(head.buffer, head.byteOffset, head.byteLength)
  let pos = 8 // 跳过签名

  // PNG 是「长度(4) + 类型(4) + 数据 + CRC(4)」的块序列
  while (pos + 8 <= head.length) {
    const length = view.getUint32(pos)
    const type = String.fromCharCode(
      head[pos + 4],
      head[pos + 5],
      head[pos + 6],
      head[pos + 7]
    )
    const dataStart = pos + 8
    const dataEnd = dataStart + length
    if (dataEnd > head.length) break

    if (type === 'tEXt') {
      const chunk = head.subarray(dataStart, dataEnd)
      const sep = chunk.indexOf(0) // keyword\0text
      if (sep > 0) {
        const key = decodeLatin1(chunk.subarray(0, sep))
        out[key] = decodeLatin1(chunk.subarray(sep + 1))
      }
    } else if (type === 'zTXt') {
      const chunk = head.subarray(dataStart, dataEnd)
      const sep = chunk.indexOf(0)
      // sep 后 1 字节是压缩方法（只有 0 = deflate），其余是压缩数据
      if (sep > 0 && chunk[sep + 1] === 0) {
        const key = decodeLatin1(chunk.subarray(0, sep))
        const text = await inflateText(chunk.subarray(sep + 2))
        if (text !== null) out[key] = text
      }
    } else if (type === 'IDAT') {
      // 图像数据开始了，后面不会再有文本块
      break
    } else if (type === 'IEND') {
      break
    }

    pos = dataEnd + 4 // +4 跳过 CRC
  }
  return out
}

/** PNG tEXt 规范是 Latin-1，但很多工具直接写 UTF-8，这里优先按 UTF-8 解 */
function decodeLatin1(bytes: Uint8Array): string {
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    return text
  } catch {
    return new TextDecoder('latin1').decode(bytes)
  }
}

async function inflateText(bytes: Uint8Array): Promise<string | null> {
  if (typeof DecompressionStream === 'undefined') return null
  try {
    const stream = new Blob([new Uint8Array(bytes)])
      .stream()
      .pipeThrough(new DecompressionStream('deflate'))
    return await new Response(stream).text()
  } catch {
    return null
  }
}

/* ------------------------------------------------------------------ */
/* ComfyUI 节点图 → 表单字段                                            */
/* ------------------------------------------------------------------ */

interface ComfyNode {
  class_type?: string
  inputs?: Record<string, unknown>
}

type ComfyGraph = Record<string, ComfyNode>

/** 图里的连线是 ["节点ID", 输出索引]，用来判断哪个 CLIPTextEncode 是正/负向 */
function isLink(value: unknown): value is [string, number] {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    typeof value[0] === 'string' &&
    typeof value[1] === 'number'
  )
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

/** 递归找所有 class_type 匹配的节点，带上它们在图里的 id */
function findNodes(
  graph: ComfyGraph,
  predicate: (node: ComfyNode) => boolean
): Array<{ id: string; node: ComfyNode }> {
  return Object.entries(graph)
    .filter(([, node]) => node && predicate(node))
    .map(([id, node]) => ({ id, node }))
}

/**
 * 找出「真正连到采样器 positive / negative 的那两个文本编码节点」。
 *
 * 不能简单取第一个 CLIPTextEncode —— 真实工作流里通常有两个以上
 * （正/负各一个，还有的是二次重绘的），取错了就会把负面词当提示词。
 */
function resolvePrompts(graph: ComfyGraph): {
  prompt?: string
  negativePrompt?: string
} {
  // 采样器有多种：KSampler / KSamplerAdvanced / SamplerCustom ...
  const samplerClasses = /^KSampler|SamplerCustom/i
  const samplers = findNodes(graph, (n) =>
    samplerClasses.test(n.class_type ?? '')
  )

  const readTextOf = (linkValue: unknown): string | undefined => {
    if (!isLink(linkValue)) return undefined
    const target = graph[linkValue[0]]
    if (!target?.inputs) return undefined
    return asString(target.inputs.text)
  }

  for (const { node } of samplers) {
    const inputs = node.inputs ?? {}
    const positive = readTextOf(inputs.positive)
    const negative = readTextOf(inputs.negative)
    if (positive || negative) {
      return { prompt: positive, negativePrompt: negative }
    }
  }

  // 兜底：没有可识别的采样器连线，就按「文本最长的是正向」猜
  const texts = findNodes(
    graph,
    (n) =>
      /CLIPTextEncode|TextEncode/i.test(n.class_type ?? '') &&
      typeof n.inputs?.text === 'string'
  )
    .map(({ node }) => asString(node.inputs?.text))
    .filter((t): t is string => Boolean(t))
    .sort((a, b) => b.length - a.length)

  return { prompt: texts[0], negativePrompt: undefined }
}

/** 底模：CheckpointLoaderSimple / CheckpointLoader / UNETLoader 的 ckpt_name/unet_name */
function resolveModel(graph: ComfyGraph): string | undefined {
  const candidates = findNodes(graph, (n) =>
    /CheckpointLoader|UNETLoader|CheckpointSave/i.test(n.class_type ?? '')
  )
  for (const { node } of candidates) {
    const inputs = node.inputs ?? {}
    const name =
      asString(inputs.ckpt_name) ??
      asString(inputs.unet_name) ??
      asString(inputs.model_name)
    if (name) return stripModelExt(name)
  }
  return undefined
}

function resolveLoras(graph: ComfyGraph): string[] {
  const names = findNodes(graph, (n) =>
    /LoraLoader/i.test(n.class_type ?? '')
  )
    .map(({ node }) => asString(node.inputs?.lora_name))
    .filter((v): v is string => Boolean(v))
    .map(stripModelExt)
  return Array.from(new Set(names))
}

function resolveSampler(graph: ComfyGraph): {
  sampler?: string
  steps?: number
  cfg?: number
  seed?: number
} {
  const samplers = findNodes(graph, (n) =>
    /^KSampler|SamplerCustom/i.test(n.class_type ?? '')
  )
  for (const { node } of samplers) {
    const inputs = node.inputs ?? {}
    const sampler =
      asString(inputs.sampler_name) ?? asString(inputs.scheduler)
    const steps = asNumber(inputs.steps)
    const cfg = asNumber(inputs.cfg)
    // 种子字段各家叫法不同：seed / noise_seed
    const seed = asNumber(inputs.seed) ?? asNumber(inputs.noise_seed)
    if (sampler || steps !== undefined || cfg !== undefined || seed !== undefined) {
      return { sampler, steps, cfg, seed }
    }
  }
  return {}
}

function resolveSize(graph: ComfyGraph): {
  width?: number
  height?: number
} {
  const nodes = findNodes(graph, (n) =>
    /EmptyLatentImage|EmptySD3LatentImage|EmptyLatentImageSDXL/i.test(
      n.class_type ?? ''
    )
  )
  for (const { node } of nodes) {
    const width = asNumber(node.inputs?.width)
    const height = asNumber(node.inputs?.height)
    if (width && height) return { width, height }
  }
  return {}
}

/** Flux 工作流把尺寸写在 EmptyLatentImage 之外的情况不少，兜底扫一遍 */
function resolveSizeFallback(graph: ComfyGraph): {
  width?: number
  height?: number
} {
  for (const node of Object.values(graph)) {
    const w = asNumber(node?.inputs?.width)
    const h = asNumber(node?.inputs?.height)
    if (w && h && w >= 64 && h >= 64) return { width: w, height: h }
  }
  return {}
}

/** 去掉模型扩展名与目录，只留可读名字 */
export function stripModelExt(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? name
  return base.replace(/\.(safetensors|ckpt|pt|pth|bin|gguf|onnx)$/i, '')
}

/**
 * 解析 ComfyUI 写进 PNG 的节点图。
 *
 * 优先用 "prompt"（精简版，只含实际执行节点），
 * 没有再退回 "workflow"（完整版，含 UI 坐标，结构更杂）。
 */
function parseComfyGraph(raw: string): ComfyGenerationMeta | null {
  let graph: unknown
  try {
    graph = JSON.parse(raw)
  } catch {
    return null
  }
  if (!graph || typeof graph !== 'object') return null

  // workflow 版本外面包了一层 { nodes: [...], links: [...] }，结构完全不同，
  // 这里只处理 prompt 那种「id -> node」的扁平结构。
  const flat = graph as ComfyGraph
  const entries = Object.entries(flat)
  if (entries.length === 0) return null
  const looksLikeNodeGraph = entries.every(
    ([, node]) =>
      node &&
      typeof node === 'object' &&
      'class_type' in (node as Record<string, unknown>)
  )
  if (!looksLikeNodeGraph) return null

  const { prompt, negativePrompt } = resolvePrompts(flat)
  if (!prompt) return null

  const size = resolveSize(flat)
  const resolvedSize =
    size.width && size.height ? size : resolveSizeFallback(flat)

  return {
    source: 'comfyui',
    prompt,
    negativePrompt,
    model: resolveModel(flat),
    loras: resolveLoras(flat),
    ...resolveSampler(flat),
    ...resolvedSize,
  }
}

/* ------------------------------------------------------------------ */
/* A1111 / WebUI parameters 格式                                       */
/* ------------------------------------------------------------------ */

/**
 * A1111 的 "parameters" 是一段人类可读文本，形如：
 *
 *   masterpiece, best quality, 1girl
 *   Negative prompt: lowres, bad hands
 *   Steps: 28, Sampler: DPM++ 2M Karras, CFG scale: 7, Seed: 123, Size: 1024x1024, Model: xxx
 */
function parseA1111(raw: string): ComfyGenerationMeta | null {
  const text = raw.replace(/\r\n/g, '\n').trim()
  if (!text) return null

  // 最后一行是参数行（以 "Steps:" 开头）
  const lines = text.split('\n')
  let paramsLine = ''
  if (/^Steps:\s*\d+/i.test(lines[lines.length - 1] ?? '')) {
    paramsLine = lines.pop() ?? ''
  }
  const body = lines.join('\n')

  const negIndex = body.search(/^Negative prompt:\s*/im)
  const prompt = (negIndex >= 0 ? body.slice(0, negIndex) : body).trim()
  const negativePrompt =
    negIndex >= 0
      ? body
          .slice(negIndex)
          .replace(/^Negative prompt:\s*/im, '')
          .trim()
      : undefined

  const grab = (key: string): string | undefined => {
    const m = paramsLine.match(new RegExp(`${key}:\\s*([^,]+)`, 'i'))
    return m?.[1]?.trim()
  }

  const sizeRaw = grab('Size')
  const sizeMatch = sizeRaw?.match(/(\d+)\s*x\s*(\d+)/i)
  const model = grab('Model')
  const stepsRaw = grab('Steps')
  const cfgRaw = grab('CFG scale')
  const seedRaw = grab('Seed')

  if (!prompt) return null

  return {
    source: 'a1111',
    prompt,
    negativePrompt,
    model: model ? stripModelExt(model) : undefined,
    sampler: grab('Sampler'),
    steps: stepsRaw ? Number(stepsRaw) || undefined : undefined,
    cfg: cfgRaw ? Number(cfgRaw) || undefined : undefined,
    seed: seedRaw ? Number(seedRaw) || undefined : undefined,
    width: sizeMatch ? Number(sizeMatch[1]) : undefined,
    height: sizeMatch ? Number(sizeMatch[2]) : undefined,
  }
}

/* ------------------------------------------------------------------ */
/* 对外入口                                                            */
/* ------------------------------------------------------------------ */

/**
 * 从一张图里提取生成参数。支持：
 * - ComfyUI（PNG tEXt 的 prompt / workflow）
 * - A1111 / Forge / WebUI（PNG tEXt 的 parameters）
 *
 * 认不出来返回 null —— 调用方按「用户自己填」处理，不要报错。
 */
export async function extractGenerationMeta(
  file: File
): Promise<ComfyGenerationMeta | null> {
  if (!/^image\/(png|webp|jpeg)$/i.test(file.type) && !/\.png$/i.test(file.name)) {
    return null
  }
  try {
    const chunks = await readPngTextChunks(file)
    // ComfyUI 主路径
    if (chunks.prompt) {
      const meta = parseComfyGraph(chunks.prompt)
      if (meta) return meta
    }
    // 少数工作流只写 workflow 不写 prompt
    if (chunks.workflow) {
      const meta = parseComfyGraph(chunks.workflow)
      if (meta) return meta
    }
    // A1111 系
    if (chunks.parameters) {
      const meta = parseA1111(chunks.parameters)
      if (meta) return meta
    }
  } catch {
    /* 解析失败等同「没识别出来」 */
  }
  return null
}

/**
 * 给提示词字段做二次清洗：去掉 ComfyUI 常见的权重语法残留，
 * 但保留括号内容（那是用户原意）。只在自动填充时用，不覆盖用户手填。
 */
export function normalizePromptText(prompt: string): string {
  return prompt
    .replace(/<lora:[^>]+>/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}
