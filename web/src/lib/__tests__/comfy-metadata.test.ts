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
import { describe, expect, test } from 'vitest'

import {
  extractGenerationMeta,
  normalizePromptText,
  stripModelExt,
} from '../comfy-metadata'

/** 构造一个最小 PNG：签名 + 若干 tEXt 块 + IEND + 少量假 IDAT */
function buildPng(texts: Record<string, string>): File {
  const parts: Uint8Array[] = []

  // 签名
  parts.push(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))

  const chunk = (type: string, data: Uint8Array) => {
    const len = new Uint8Array(4)
    new DataView(len.buffer).setUint32(0, data.length)
    const typeBytes = new Uint8Array(
      [...type].map((c) => c.charCodeAt(0))
    )
    const crc = new Uint8Array(4) // 解析器不校验 CRC
    return [len, typeBytes, data, crc]
  }

  for (const [key, value] of Object.entries(texts)) {
    const payload = new Uint8Array([
      ...new TextEncoder().encode(key),
      0,
      ...new TextEncoder().encode(value),
    ])
    parts.push(...chunk('tEXt', payload))
  }

  // 一个假 IDAT（解析器遇到它就停）
  parts.push(...chunk('IDAT', new Uint8Array([1, 2, 3])))
  parts.push(...chunk('IEND', new Uint8Array([])))

  return new File(parts as BlobPart[], 'test.png', { type: 'image/png' })
}

/** 典型 SDXL txt2img 工作流的 prompt（API 格式） */
const COMFY_PROMPT = JSON.stringify({
  '3': {
    class_type: 'KSampler',
    inputs: {
      seed: 882374651,
      steps: 28,
      cfg: 7.5,
      sampler_name: 'dpmpp_2m',
      scheduler: 'karras',
      positive: ['6', 0],
      negative: ['7', 0],
      latent_image: ['5', 0],
    },
  },
  '4': {
    class_type: 'CheckpointLoaderSimple',
    inputs: { ckpt_name: 'juggernautXL_v9.safetensors' },
  },
  '5': {
    class_type: 'EmptyLatentImage',
    inputs: { width: 1024, height: 1024, batch_size: 1 },
  },
  '6': {
    class_type: 'CLIPTextEncode',
    inputs: { text: 'a cat sitting on a windowsill, golden hour', clip: ['4', 1] },
  },
  '7': {
    class_type: 'CLIPTextEncode',
    inputs: { text: 'lowres, blurry, watermark', clip: ['4', 1] },
  },
  '10': {
    class_type: 'LoraLoader',
    inputs: { lora_name: 'filmGrain_v2.safetensors', strength_model: 0.8 },
  },
})

describe('extractGenerationMeta - ComfyUI', () => {
  test('从标准 SDXL 工作流提取正向/负向提示词与参数', async () => {
    const file = buildPng({ prompt: COMFY_PROMPT })
    const meta = await extractGenerationMeta(file)

    expect(meta).not.toBeNull()
    expect(meta?.source).toBe('comfyui')
    // 必须拿到连到 positive 的那个，而不是图里第一个 CLIPTextEncode
    expect(meta?.prompt).toBe(
      'a cat sitting on a windowsill, golden hour'
    )
    expect(meta?.negativePrompt).toBe('lowres, blurry, watermark')
    expect(meta?.model).toBe('juggernautXL_v9')
    expect(meta?.loras).toEqual(['filmGrain_v2'])
    expect(meta?.sampler).toBe('dpmpp_2m')
    expect(meta?.steps).toBe(28)
    expect(meta?.cfg).toBe(7.5)
    expect(meta?.seed).toBe(882374651)
    expect(meta?.width).toBe(1024)
    expect(meta?.height).toBe(1024)
  })

  test('节点顺序颠倒时仍按连线取提示词，而不是取第一个文本节点', async () => {
    const graph = JSON.parse(COMFY_PROMPT)
    // 把负向节点排到前面：Object.keys 顺序变了
    const reordered = {
      '7': graph['7'],
      '3': graph['3'],
      '6': graph['6'],
      '4': graph['4'],
      '5': graph['5'],
    }
    const file = buildPng({ prompt: JSON.stringify(reordered) })
    const meta = await extractGenerationMeta(file)
    expect(meta?.prompt).toBe(
      'a cat sitting on a windowsill, golden hour'
    )
    expect(meta?.negativePrompt).toBe('lowres, blurry, watermark')
  })

  test('Flux 风格 KSamplerAdvanced + noise_seed 也能认', async () => {
    const flux = JSON.stringify({
      '1': {
        class_type: 'KSamplerAdvanced',
        inputs: {
          noise_seed: 42,
          steps: 20,
          cfg: 1,
          sampler_name: 'euler',
          positive: ['2', 0],
          negative: ['2', 0],
        },
      },
      '2': {
        class_type: 'CLIPTextEncode',
        inputs: { text: 'neon city at night' },
      },
      '3': {
        class_type: 'UNETLoader',
        inputs: { unet_name: 'flux1-dev-fp8.safetensors' },
      },
    })
    const meta = await extractGenerationMeta(buildPng({ prompt: flux }))
    expect(meta?.prompt).toBe('neon city at night')
    expect(meta?.model).toBe('flux1-dev-fp8')
    expect(meta?.seed).toBe(42)
    expect(meta?.sampler).toBe('euler')
  })

  test('只写 workflow 不写 prompt 时也能解析', async () => {
    const meta = await extractGenerationMeta(
      buildPng({ workflow: COMFY_PROMPT })
    )
    expect(meta?.prompt).toBe('a cat sitting on a windowsill, golden hour')
  })

  test('没有可识别文本时返回 null，而不是抛错', async () => {
    expect(await extractGenerationMeta(buildPng({ Comment: 'hi' }))).toBeNull()
  })

  test('损坏的 JSON 返回 null', async () => {
    expect(
      await extractGenerationMeta(buildPng({ prompt: '{not json' }))
    ).toBeNull()
  })

  test('非 PNG 文件直接返回 null', async () => {
    const jpeg = new File([new Uint8Array([0xff, 0xd8, 0xff])], 'a.jpg', {
      type: 'image/jpeg',
    })
    expect(await extractGenerationMeta(jpeg)).toBeNull()
  })
})

describe('extractGenerationMeta - A1111 parameters', () => {
  const PARAMS = [
    'masterpiece, best quality, 1girl, silver hair',
    'Negative prompt: lowres, bad anatomy',
    'Steps: 28, Sampler: DPM++ 2M Karras, CFG scale: 7, Seed: 1234567890, Size: 832x1216, Model: animePastel_v3',
  ].join('\n')

  test('解析 A1111 parameters 全字段', async () => {
    const meta = await extractGenerationMeta(
      buildPng({ parameters: PARAMS })
    )
    expect(meta?.source).toBe('a1111')
    expect(meta?.prompt).toBe('masterpiece, best quality, 1girl, silver hair')
    expect(meta?.negativePrompt).toBe('lowres, bad anatomy')
    expect(meta?.model).toBe('animePastel_v3')
    expect(meta?.steps).toBe(28)
    expect(meta?.cfg).toBe(7)
    expect(meta?.seed).toBe(1234567890)
    expect(meta?.width).toBe(832)
    expect(meta?.height).toBe(1216)
    expect(meta?.sampler).toBe('DPM++ 2M Karras')
  })

  test('没有 Negative prompt 与参数行时只取提示词', async () => {
    const meta = await extractGenerationMeta(
      buildPng({ parameters: 'just a prompt, no params' })
    )
    expect(meta?.prompt).toBe('just a prompt, no params')
    expect(meta?.negativePrompt).toBeUndefined()
    expect(meta?.steps).toBeUndefined()
  })
})

describe('辅助函数', () => {
  test('stripModelExt 去掉目录与扩展名', () => {
    expect(stripModelExt('C:\\models\\sdxl\\foo.ckpt')).toBe('foo')
    expect(stripModelExt('flux1-dev.gguf')).toBe('flux1-dev')
    expect(stripModelExt('noext')).toBe('noext')
  })

  test('normalizePromptText 去掉 lora 标签并压缩空白', () => {
    expect(
      normalizePromptText('a cat  <lora:foo:0.8>  on a mat')
    ).toBe('a cat on a mat')
  })
})
