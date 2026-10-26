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
 * HomeConfig 数据契约（单一真源）
 * ------------------------------------------------------------------
 * 前台 gallery-home 与后台「二开设置 → 首页设置」共用同一份 zod 结构：
 * - 后台保存前用 `HomeConfigSchema` 校验，避免脏数据写进 option
 * - 前台 /api/home_config 返回值用 `parseHomeConfig` 安全解析，
 *   结构不符时只忽略异常分支，页面回退到内置默认值而不是白屏
 * 全部字段 optional：HomeConfig 是「增量覆盖」，没配的项走默认值。
 */

import { z } from 'zod'

import { HOME_FALLBACK_LOCALE } from './locales'

/** 首屏视频轮播：任意段数，按顺序循环播放 */
export const heroVideoSchema = z.object({
  enabled: z.boolean().optional(),
  videos: z.array(z.string().min(1)).max(20).optional(),
  mask: z.number().min(0).max(1).optional(),
})

/** 首屏底部模型滚动条 */
export const heroTickerSchema = z.object({
  enabled: z.boolean().optional(),
  durationSec: z.number().min(5).max(300).optional(),
  prefix: z.string().max(60).optional(),
})

export const motionSchema = z.object({
  heroVideo: heroVideoSchema.optional(),
  heroTicker: heroTickerSchema.optional(),
  ticker: z.array(z.string().min(1)).max(60).optional(),
})

const text = (max = 400) => z.string().max(max)
const short = (max = 120) => z.string().max(max)

const agentSkillSchema = z.object({
  key: short(40),
  label: short(60),
  icon: short(40),
})

const agentFeatureSchema = z.object({
  icon: short(40),
  title: short(),
  desc: text(),
})

const agentPreviewSchema = z.object({
  bubble: text(),
  title: short(),
  badge: short(),
  plan: z.array(text(200)).max(12).optional(),
  steps: z.array(short(60)).max(12).optional(),
  editLabel: short().optional(),
  runLabel: short().optional(),
})

const studioItemSchema = z.object({
  image: text(300),
  kicker: short(60),
  title: short(),
  desc: text(),
  cta: short(60),
  url: text(300),
})

const galleryItemSchema = z.object({
  title: short(),
  model: short(80),
  cover: text(300),
  url: text(300),
})

const modelItemSchema = z.object({
  rank: z.number().int().min(1).optional(),
  name: short(80),
  type: short(120),
  thumb: text(300),
  url: text(300),
})

export const homeConfigSchema = z
  .object({
    hero: z
      .object({
        title: text(200).optional(),
        titleAccent: text(200).optional(),
        subtitle: text(600).optional(),
        badge: short(40).optional(),
        announcement: text(300).optional(),
        primaryLabel: short(80).optional(),
        primaryUrl: text(300).optional(),
        secondaryLabel: short(80).optional(),
        secondaryTime: short(20).optional(),
        metaLabels: z.array(short(60)).max(8).optional(),
        card: z
          .object({
            enabled: z.boolean().optional(),
            tag: short(60).optional(),
            title: short().optional(),
            model: short(80).optional(),
            ratio: short(20).optional(),
            count: short(20).optional(),
          })
          .optional(),
      })
      .optional(),
    agent: z
      .object({
        eyebrow: short(60).optional(),
        titleLine1: text(200).optional(),
        titleLine2: text(200).optional(),
        lead: text(600).optional(),
        placeholder: text(300).optional(),
        attachLabel: short(60).optional(),
        autoLabel: short(60).optional(),
        skillsMenuTitle: short(60).optional(),
        helperLabel: short(120).optional(),
        sendLabel: short(40).optional(),
        skills: z.array(agentSkillSchema).max(24).optional(),
        features: z.array(agentFeatureSchema).max(12).optional(),
        preview: agentPreviewSchema.optional(),
      })
      .optional(),
    studios: z
      .object({
        eyebrow: short(120).optional(),
        title: text(200).optional(),
        lead: text(600).optional(),
        items: z.array(studioItemSchema).max(12).optional(),
      })
      .optional(),
    gallery: z
      .object({
        eyebrow: short(120).optional(),
        title: text(200).optional(),
        lead: text(600).optional(),
        tabs: z.array(short(40)).max(8).optional(),
        exploreLabel: short(80).optional(),
        featuredTitle: short(120).optional(),
        featuredVideo: text(300).optional(),
        items: z.array(galleryItemSchema).max(24).optional(),
      })
      .optional(),
    models: z
      .object({
        eyebrow: short(120).optional(),
        title: text(200).optional(),
        lead: text(600).optional(),
        exploreLabel: short(80).optional(),
        items: z.array(modelItemSchema).max(40).optional(),
      })
      .optional(),
    cta: z
      .object({
        title: text(200).optional(),
        lead: text(600).optional(),
        features: z.array(short(80)).max(8).optional(),
        codeTitle: short(80).optional(),
        code: z.string().max(4000).optional(),
        genLabel: short(40).optional(),
        connectLabel: short(80).optional(),
        connectUrl: text(300).optional(),
      })
      .optional(),
    closing: z
      .object({
        kicker: short(120).optional(),
        title: text(200).optional(),
        lead: text(600).optional(),
        primaryLabel: short(80).optional(),
        secondaryLabel: short(80).optional(),
        primaryUrl: text(300).optional(),
        secondaryUrl: text(300).optional(),
      })
      .optional(),
    motion: motionSchema.optional(),
  })
  // 允许未来新增分支而不破坏既有配置（旧版本遗留字段直接透传合并）
  .passthrough()

export type HomeConfig = z.infer<typeof homeConfigSchema>

/**
 * 安全解析后台返回的配置。
 * 解析失败不抛错：返回 null，调用方回退到内置默认值。
 */
export function parseHomeConfig(raw: unknown): HomeConfig | null {
  if (!raw || typeof raw !== 'object') return null
  const result = homeConfigSchema.safeParse(raw)
  if (!result.success) {
    if (import.meta.env?.DEV) {
      console.warn('[gallery-home] home_config 校验失败，已回退默认值', result.error.issues)
    }
    return null
  }
  return result.data
}

/* ------------------------------------------------------------------
 * v2：按语种分桶
 * ------------------------------------------------------------------
 * v1 的配置是「一份覆盖打全站」——后台用哪个界面语言改，写进去的就是
 * 哪种语言的字符串，前台切到别的语种也显示它（改过的字段被锁死）。
 *
 * v2 结构：
 *   { version: 2,
 *     locales: { en: {...}, zhCN: {...}, ... },  // 文案，按语种各存一份
 *     shared:  { motion: {...}, hero: { primaryUrl } } }  // 视频/链接/开关，跨语种共用
 *
 * 合并顺序（见 api.ts）：内置默认 → locales.en → locales[当前语种] → shared
 * - shared 放最后：它是「所有语种都用同一份」的资源，优先级最高
 * - locales.en 兜底：某语种没填时先用英文，而不是直接掉回内置默认
 */

/* ------------------------------------------------------------------
 * 区块（页面结构）配置：顺序、显隐、自定义区块
 * ------------------------------------------------------------------
 * 与语种无关，挂在 v2 顶层（不属于 locales/shared）：
 *   blocks: { order: string[], hidden: Record<string, boolean> }
 *   custom: Record<id, CustomBlock>
 * - order 列出区块 key（内置 key + 自定义 id），决定前台渲染顺序
 * - hidden 按 key 标记是否隐藏（隐藏的区块前台不渲染）
 * - 自定义区块是一段通用文案/横幅，可由后台「添加区块」动态插入
 */
export const BLOCK_KEYS = [
  'hero',
  'agent',
  'studios',
  'gallery',
  'models',
  'cta',
  'closing',
  'ticker',
] as const
export type BuiltinBlockKey = (typeof BLOCK_KEYS)[number]

export const customBlockSchema = z.object({
  id: z.string().min(1).max(40),
  kind: z.enum(['text', 'banner']).default('text'),
  kicker: short(120).optional(),
  title: short(120).optional(),
  body: text(2000).optional(),
  url: text(300).optional(),
  urlLabel: short(80).optional(),
  bg: z.enum(['default', 'tinted']).default('default'),
})
export type CustomBlock = z.infer<typeof customBlockSchema>

export const blocksSchema = z.object({
  order: z.array(z.string().min(1).max(40)).optional(),
  hidden: z.record(z.string(), z.boolean()).optional(),
})

export const homeConfigV2Schema = z
  .object({
    version: z.literal(2).optional(),
    locales: z.record(z.string(), homeConfigSchema).optional(),
    shared: homeConfigSchema.optional(),
    blocks: blocksSchema.optional(),
    custom: z.record(z.string(), customBlockSchema).optional(),
  })
  .passthrough()

export type HomeConfigV2 = z.infer<typeof homeConfigV2Schema>

/**
 * 把任意历史格式归一化成 v2。
 * - 已是 v2 → 校验后直接返回
 * - v1 / 未知结构 → 整份覆盖搬进 locales[en]（保留旧行为，不丢数据），
 *   motion 搬到 shared（视频列表本就跨语种）
 * 坏数据不抛错：返回空 v2，前台走内置默认值。
 */
export function normalizeHomeConfig(raw: unknown): HomeConfigV2 {
  const empty: HomeConfigV2 = { version: 2, locales: {}, shared: {} }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return empty

  const input = raw as Record<string, unknown>
  const looksV2 =
    input.version === 2 || !!input.locales || !!input.shared

  if (looksV2) {
    const parsed = homeConfigV2Schema.safeParse(input)
    if (!parsed.success) {
      warnInvalid(parsed.error.issues)
      return empty
    }
    return parsed.data
  }

  const { motion, ...rest } = input
  const locales: Record<string, HomeConfig> = {}
  const parsedRest = homeConfigSchema.safeParse(rest)
  if (!parsedRest.success) {
    warnInvalid(parsedRest.error.issues)
  } else if (Object.keys(rest).length > 0) {
    locales[HOME_FALLBACK_LOCALE] = parsedRest.data
  }

  const shared: HomeConfig = {}
  if (motion !== undefined) {
    const parsedMotion = motionSchema.safeParse(motion)
    if (parsedMotion.success) {
      shared.motion = parsedMotion.data
    } else {
      warnInvalid(parsedMotion.error.issues)
    }
  }

  return { version: 2, locales, shared }
}

function warnInvalid(issues: unknown) {
  if (import.meta.env?.DEV) {
    console.warn('[gallery-home] home_config 校验失败，已忽略异常分支', issues)
  }
}
