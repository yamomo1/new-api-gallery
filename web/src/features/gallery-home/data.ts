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
 * GalleryHome 首页默认数据
 * ------------------------------------------------------------------
 * 首页完全数据驱动：改这里的文案/图片/链接即改页面。
 * URL 已适配 New API（rc.46）真实路由：/prompt-gallery、/pricing、/about、/sign-up。
 *
 * 多语种约定（与 New API 现有 i18n 一致）：
 * - 这里的文案一律写 **英文原文**，字符串本身就是 i18n key
 * - `buildHomeData(t)` 深遍历把每个可翻译字段过一遍 t()
 * - 英文不需要额外翻译（缺失 key 时 i18next 回退 key 本身）
 * - zh / zh-TW / ja / fr / ru / vi 在 src/i18n/locales 里补译文
 * - RAW_KEYS 里的字段是路径/色值/品牌名/图标名，不参与翻译
 */

import { HOME_FALLBACK_LOCALE } from './locales'
import type { HomeConfig, HomeConfigV2 } from './schema'

export type Translate = (key: string) => string

export type HeroColors = {
  screenBg: string
  ink: string
  muted: string
  line: string
  accentFrom: string
  accentVia: string
  accentTo: string
  scrimTop: string
  scrimMid: string
  scrimBottom: string
  badgeFrom: string
  badgeTo: string
  primaryBtn: string
  primaryBtnInk: string
}

export type HeroCardConfig = {
  enabled: boolean
  tag: string
  title: string
  model: string
  ratio: string
  count: string
  images: string[]
}

/** 不参与翻译的字段（路径、色值、品牌名、代码、枚举） */
const RAW_KEYS = new Set([
  'url',
  'primaryUrl',
  'secondaryUrl',
  'connectUrl',
  'featuredVideo',
  'videos',
  'image',
  'thumb',
  'cover',
  'art',
  'images',
  'code',
  'icon',
  'key',
  'index',
  'rank',
  'model',
  'name',
  'ticker',
  'bg',
  'dot',
  'text',
  'secondaryTime',
  'ratio',
  'count',
  'screenBg',
  'ink',
  'muted',
  'line',
  'accentFrom',
  'accentVia',
  'accentTo',
  'scrimTop',
  'scrimMid',
  'scrimBottom',
  'badgeFrom',
  'badgeTo',
  'primaryBtn',
  'primaryBtnInk',
])

/**
 * 深遍历：对所有可翻译字符串调用 fn（RAW_KEYS 字段与 RAW 数组整体跳过）。
 * localize 与 collectStrings 共用同一套遍历，保证「渲染时翻译了哪些」
 * 和「测试里检查了哪些」永远一致。
 */
function mapStrings<T>(node: T, fn: (s: string) => string, key?: string): T {
  if (typeof node === 'string') {
    if (key && RAW_KEYS.has(key)) return node
    return fn(node as string) as unknown as T
  }
  if (Array.isArray(node)) {
    if (key && RAW_KEYS.has(key)) return node
    return node.map((item) =>
      typeof item === 'string' ? (fn(item as string) as unknown as T) : mapStrings(item, fn),
    ) as unknown as T
  }
  if (node && typeof node === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      out[k] = mapStrings(v, fn, k)
    }
    return out as unknown as T
  }
  return node
}

function localize<T>(node: T, t: Translate): T {
  return mapStrings(node, t)
}

/** 收集结构里所有需要翻译的原文（用于译文覆盖率测试） */
export function collectStrings(node: unknown, out: string[] = []): string[] {
  mapStrings(node, (s) => {
    if (!out.includes(s)) out.push(s)
    return s
  })
  return out
}

/* ------------------------------------------------------------------ */

export const HOME_DATA = {
  hero: {
    title: 'Imagine it.',
    titleAccent: 'Let it be real.',
    subtitle:
      'A place that turns your ideas into images, films and more. Create with leading AI models, all in one workspace.',
    badge: 'New',
    announcement: 'Canvas Agent is live: say one sentence, the canvas builds itself',
    primaryLabel: 'Start creating with Agent',
    primaryUrl: '/prompt-gallery',
    secondaryLabel: 'Watch the intro',
    secondaryUrl: '',
    secondaryTime: '0:47',
    metaLabels: ['No membership needed', 'Pay as you go', 'Low prices for everyone'],
    colors: {
      screenBg: '#030b0f',
      ink: '#f5f1e8',
      muted: 'rgba(245, 241, 232, 0.66)',
      line: 'rgba(255, 255, 255, 0.14)',
      accentFrom: '#f6d29a',
      accentVia: '#e2a056',
      accentTo: '#fff0d4',
      scrimTop: 'rgba(3, 11, 15, 0.6)',
      scrimMid: 'rgba(3, 11, 15, 0.82)',
      scrimBottom: '#030b0f',
      badgeFrom: '#f6d29a',
      badgeTo: '#e2a056',
      primaryBtn: '#d9ff43',
      primaryBtnInk: '#08120a',
    } as HeroColors,
    card: {
      enabled: true,
      tag: 'Four images generated',
      title: 'Silver hooded portrait, warm backlight, minimal black background',
      model: 'GPT Image 2.5',
      ratio: '3:4',
      count: '×3',
      images: [
        '/images/home/model-image-v4.webp',
        '/images/home/studio-portrait-v3.webp',
        '/images/home/model-image-v3.webp',
      ],
    } as HeroCardConfig,
  },
  agent: {
    index: '01',
    eyebrow: 'Canvas Agent',
    // Asymmetric head: two-line serif title left, lead in a narrow right column
    titleLine1: 'Say the idea.',
    titleLine2: 'The Agent builds the canvas.',
    lead: 'Describe what you want in one sentence. Canvas Agent picks the models, writes every prompt, wires the references and shows the price before you approve.',
    // Large composer: reference attach + auto mode + helper + round send button
    placeholder: 'Describe what you want to create, for example "a six-page watercolor picture book about a fox learning to share"',
    attachLabel: 'Reference images',
    autoLabel: 'Auto (recommended)',
    skillsMenuTitle: 'Agent skills',
    helperLabel: 'You approve the plan before anything is generated',
    sendLabel: 'Send',
    // Skills shared by the dropdown and the chips below (matched by key)
    skills: [
      { key: 'book', label: 'Picture book', icon: 'BookOpen', preset: 'A six-page watercolor picture book about a little fox learning to share, soft warm palette' },
      { key: 'comic', label: 'Comic panels', icon: 'LayoutGrid', preset: 'A four-panel comic about a robot and a stray cat becoming friends, clean line art, expressive faces' },
      { key: 'character', label: 'Character sheet', icon: 'User', preset: 'A hero character sheet: front, side and back views, with a full body and three expression close-ups' },
      { key: 'poster', label: 'Poster series', icon: 'Images', preset: 'Three summer coffee promo posters in a fresh blue-white style, bold typography, clean layout' },
      { key: 'storyboard', label: 'Storyboard', icon: 'Film', preset: 'A six-shot storyboard: a girl finds a lost kitten in the rain and brings it home, warm cinematic light' },
      { key: 'video', label: 'Multi-shot video', icon: 'Video', preset: 'An astronaut cat exploring a misty night city, three shots of five seconds each, cinematic feel' },
    ],
    // Left column: feature list (icon + title + description)
    features: [
      {
        icon: 'LayoutGrid',
        title: 'One sentence plans the whole workflow',
        desc: 'Models, prompts, nodes and connections are laid out on the canvas, ready to run.',
      },
      {
        icon: 'Sparkles',
        title: 'Skills for everyday tasks',
        desc: 'Picture books, comics, character sheets, poster series, multi-shot video and product sets — all from one sentence.',
      },
      {
        icon: 'Images',
        title: 'Works with your references',
        desc: 'Pick images or @ mention nodes; the Agent keeps characters and products consistent in every shot.',
      },
      {
        icon: 'ShieldCheck',
        title: 'You stay in control',
        desc: 'Review the plan and estimated price first. Nothing is generated until you approve.',
      },
    ],
    // Right column: "Canvas Agent" product preview card
    preview: {
      bubble: 'An astronaut exploring a night city, three shots of five seconds each, cinematic',
      title: 'Canvas Agent',
      badge: 'Plan ready',
      plan: [
        'Character reference locked for consistency',
        'Three shot prompts written and wired',
        'Estimated price shown before running',
      ],
      steps: ['Character locked', 'Shot 1', 'Shot 2', 'Shot 3'],
      editLabel: 'Edit plan',
      runLabel: 'Approve and run',
    },
  },
  studios: {
    index: '02',
    eyebrow: 'One idea. Every way to make it.',
    title: 'One idea. Every way to make it.',
    lead: 'A visual workspace for exploring, focused studios for speed, and steady model access once an idea becomes a product.',
    items: [
      {
        image: '/images/home/creative-canvas-artwork.webp',
        kicker: 'Canvas',
        title: 'Compose on an infinite canvas',
        desc: 'Arrange references, prompts, images, video, and sound in one fluid visual workflow. Keep the whole idea in view.',
        cta: 'Enter the canvas',
        url: '/canvas',
      },
      {
        image: '/images/home/studio-portrait-v3.webp',
        kicker: 'Image studio',
        title: 'Text to image',
        desc: 'From one sentence to polished images with the leading image models at hand.',
        cta: 'Browse image work',
        url: '/prompt-gallery',
      },
      {
        image: '/images/home/model-cinema-v3.webp',
        kicker: 'Video studio',
        title: 'Text to video',
        desc: 'Turn words or still frames into cinematic shots, and direct every second.',
        cta: 'Browse video work',
        url: '/prompt-gallery',
      },
    ],
  },
  gallery: {
    index: '03',
    eyebrow: 'A little inspiration. Unlimited possibilities.',
    title: 'A little inspiration. Unlimited possibilities.',
    lead: 'Good ideas deserve to be shared. Browse the work, discover prompts, and take them somewhere new.',
    tabs: ['All', 'Image', 'Video'],
    exploreLabel: 'Browse the gallery',
    featuredTitle: 'Inspiration square · Community picks',
    featuredVideo: '/videos/gallery-video.mp4',
    items: [
      {
        title: '90s cool-tone fantasy portrait in emerald hanfu',
        model: 'gpt-image-2.5',
        cover: '/images/home/model-image-v4.webp',
        url: '/prompt-gallery',
      },
      {
        title: 'Ultra-detailed 3D comic star collectible poster',
        model: 'gpt-image-2.5',
        cover: '/images/home/studio-portrait-v3.webp',
        url: '/prompt-gallery',
      },
      {
        title: 'Retro racing poster design prompt',
        model: 'gpt-image-2.5',
        cover: '/images/home/creative-studios.webp',
        url: '/prompt-gallery',
      },
      {
        title: 'Chibi character sticker set prompt',
        model: 'gpt-image-2.5',
        cover: '/images/home/model-image-v3.webp',
        url: '/prompt-gallery',
      },
      {
        title: 'Children’s science poster: meet the bees',
        model: 'gpt-image-2.5',
        cover: '/images/home/creative-workspace-hero.webp',
        url: '/prompt-gallery',
      },
    ],
  },
  models: {
    index: '04',
    eyebrow: 'Top models, no maze.',
    title: 'Top models, no maze.',
    lead: 'Start with the models people reach for most. Compare price and capability whenever you are ready.',
    stats: { models: 295, providers: 30 },
    exploreLabel: 'Browse models and pricing',
    items: [
      {
        rank: 1,
        name: 'Seedance 2.5',
        type: 'Video generation · Text to video',
        thumb: '/images/home/model-cinema-v4.webp',
        url: '/pricing',
      },
      {
        rank: 2,
        name: 'Seedance 2.0',
        type: 'Video generation · Text to video',
        thumb: '/images/home/hero-world-v3.webp',
        url: '/pricing',
      },
      {
        rank: 3,
        name: 'GPT Image 2.5',
        type: 'Image generation · Text to image',
        thumb: '/images/home/model-image-v4.webp',
        url: '/pricing',
      },
      {
        rank: 4,
        name: 'Seedream 5 Pro',
        type: 'Image generation · Text to image',
        thumb: '/images/home/model-image-v3.webp',
        url: '/pricing',
      },
      {
        rank: 5,
        name: 'Kling',
        type: 'Video generation · Text to video',
        thumb: '/images/home/creative-workspace-hero.webp',
        url: '/pricing',
      },
      {
        rank: 6,
        name: 'MinMax H3',
        type: 'Video generation',
        thumb: '/images/home/creative-studios.webp',
        url: '/pricing',
      },
      {
        rank: 7,
        name: 'Vidu',
        type: 'Video generation · Text to video',
        thumb: '/images/home/canvas-world-v3.webp',
        url: '/pricing',
      },
      {
        rank: 8,
        name: 'Wan 3.0',
        type: 'Video generation · Image to video',
        thumb: '/images/home/model-reasoning-v3.webp',
        url: '/pricing',
      },
      {
        rank: 9,
        name: 'HappyHorse',
        type: 'Video generation · Text to video',
        thumb: '/images/home/closing-horizon-v3.webp',
        url: '/pricing',
      },
      {
        rank: 10,
        name: 'DeepSeek',
        type: 'Chat · Reasoning',
        thumb: '/images/home/model-reasoning-v4.webp',
        url: '/pricing',
      },
    ],
  },
  cta: {
    index: '05',
    title: 'Ship with one compatible API.',
    lead: 'Call chat, image and video models through one consistent API — access, routing and usage logs all in one place.',
    features: ['OpenAI-compatible routing', 'One key, all models', 'Transparent billing'],
    codeTitle: 'Code example',
    code: `curl https://your-domain/v1/chat/completions \\
  -H "Authorization: Bearer $API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "deepseek/deepseek-v4-pro",
    "messages": [{"role": "user", "content": "Hello"}]
  }'`,
    genLabel: 'Generate',
    connectLabel: 'Connect now',
    connectUrl: '/pricing',
  },
  closing: {
    kicker: 'Your next idea starts here',
    title: 'Create with taste. Scale without friction.',
    lead:
      'Start visually on the canvas, drop into a focused studio, or wire the same models into your own product.',
    primaryLabel: 'Start creating',
    primaryUrl: '/prompt-gallery',
    secondaryLabel: 'Start using',
    secondaryUrl: '/sign-up',
    art: '/images/home/closing-horizon-v3.webp',
  },
}

export const MOTION_DATA = {
  // Hero video playlist: any number of clips, played in order then looped
  heroVideo: {
    enabled: true,
    videos: ['/videos/hero-video.mp4', '/videos/gallery-video.mp4'],
    mask: 0.82,
  },
  heroTicker: {
    enabled: true,
    durationSec: 42,
    bg: 'rgba(255, 255, 255, 0.04)',
    dot: '#f7bf77',
    text: 'rgba(245, 241, 232, 0.74)',
    prefix: 'Now available',
  },
  ticker: [
    'DeepSeek',
    'Seedance 2.5',
    'Seedance 2.0',
    'GPT Image 2.5',
    'Seedream 5 Pro',
    'Kling',
    'MinMax H3',
    'Vidu',
    'Wan 3.0',
    'HappyHorse',
  ],
  tickerSec: 30,
}

/* ------------------------------------------------------------------ */

/** 按当前语言生成本地化后的首页默认数据 */
export function buildHomeData(t: Translate) {
  return localize(HOME_DATA, t)
}

/** 动效/轮播数据： video 列表支持后台覆盖任意段数 */
export function buildMotionData(
  t: Translate,
  override?: NonNullable<HomeConfig['motion']> | null,
) {
  const base = localize(MOTION_DATA, t)
  const videos = override?.heroVideo?.videos
  return {
    ...base,
    heroVideo: {
      ...base.heroVideo,
      ...(override?.heroVideo ?? {}),
      videos:
        Array.isArray(videos) && videos.length
          ? videos.filter((v) => typeof v === 'string' && v.trim() !== '')
          : base.heroVideo.videos,
    },
    heroTicker: { ...base.heroTicker, ...(override?.heroTicker ?? {}) },
  }
}

/* ------------------------------------------------------------------
 * 后台「二开设置 → 首页设置」动态配置
 * 存储为 HomeConfig option（JSON 字符串），公开接口 GET /api/home_config。
 * 对象深合并、数组/字符串整体覆盖，未配置的字段走内置默认值。
 * ------------------------------------------------------------------ */
function isPlainObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

export function mergeHomeConfig<T>(base: T, override: unknown): T {
  if (!isPlainObj(override)) return base
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) }
  for (const [k, v] of Object.entries(override)) {
    if (v === undefined || v === null || v === '') continue
    if (isPlainObj(v) && isPlainObj(out[k])) {
      out[k] = mergeHomeConfig(out[k], v)
    } else {
      out[k] = v
    }
  }
  return out as T
}

type MotionOverride = NonNullable<HomeConfigV2['shared']>['motion']

/**
 * 按语种挑出要叠加的覆盖层（v2 结构）。
 *
 * 文案顺序：locales[en] → locales[lang] → shared
 * - 先铺英文兜底，再用当前语种覆盖它
 * - shared 放最后：视频、链接这类跨语种资源应当盖过任何语种的文案覆盖
 * - 语言缺失/无法识别时只铺英文，等同「回退到英文」
 *
 * motion 单独合并（locales 里只会出现 heroTicker.prefix 这类文案），
 * 交给 buildMotionData 处理视频段数。
 */
export function resolveHomeOverride(
  cfg: HomeConfigV2,
  lang: string,
): { layers: unknown[]; motion: MotionOverride } {
  const en = cfg.locales?.[HOME_FALLBACK_LOCALE]
  const locale = lang === HOME_FALLBACK_LOCALE ? undefined : cfg.locales?.[lang]
  const shared = cfg.shared

  let motion: MotionOverride = {}
  if (en?.motion) motion = mergeHomeConfig(motion, en.motion)
  if (locale?.motion) motion = mergeHomeConfig(motion, locale.motion)
  if (shared?.motion) motion = mergeHomeConfig(motion, shared.motion)

  return { layers: [en, locale, shared].filter(Boolean), motion }
}
