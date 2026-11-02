/*
 * 模型目录（后台「模型设置」维护）
 *
 * 存储：Option `GalleryModelCatalog`（JSON），随 /api/status 下发。
 * 两类：image（图片生成页可用）/ video（视频生成页可用）。
 * 生成器页的「选择模型」弹窗按类别过滤展示。
 */

export type ModelCategory = 'image' | 'video'

export type CatalogModel = {
  id: string
  /** 展示名，如「智能图片V2」 */
  name: string
  /** 一句话说明 */
  description?: string
  /** 能力标签：多参考图 / 超清4K / 风格模型 / 指令编辑强 … */
  tags?: string[]
  /** 角标：NEW / HOT / VIP … */
  badge?: string
  category: ModelCategory
  /** 图标键（见 MODEL_ICON_KEYS）、emoji 或供应商图标键 */
  icon?: string
  /** 图标图片地址（后台填了 URL 时使用，优先级高于 icon） */
  iconUrl?: string
  enabled: boolean
}

export type ModelCatalog = {
  version: 1
  models: CatalogModel[]
}

export const MODEL_ICON_KEYS = ['spark', 'wave', 'hex', 'orbit', 'leaf'] as const

/** 默认目录：取自 liblib 选择模型弹窗的可见项（仅作初始值，后台可改） */
const DEFAULT_MODELS: CatalogModel[] = [
  {
    id: 'smart-image-v2',
    name: '智能图片V2',
    description: '多参考生成，长文本能力突出',
    tags: ['多参考图', '超清4K'],
    badge: 'NEW',
    category: 'image',
    icon: 'spark',
    enabled: true,
  },
  {
    id: 'seedream-5-pro',
    name: 'Seedream 5.0 Pro',
    description: '精准交互式编辑，支持原生多语言排版',
    tags: ['多参考图'],
    badge: 'NEW',
    category: 'image',
    icon: 'wave',
    enabled: true,
  },
  {
    id: 'seedream-5-lite',
    name: 'Seedream 5.0 Lite',
    description: '指令响应更精准，生成效果更智能',
    tags: ['超清4K', '多参考图'],
    badge: 'NEW',
    category: 'image',
    icon: 'wave',
    enabled: true,
  },
  {
    id: 'omni-image-v2-flash',
    name: '全能图片模型V2-Flash',
    description: '全能编辑模型，联网搜索，速度更快',
    tags: ['超清4K', '多参考图', '指令编辑强'],
    badge: 'NEW',
    category: 'image',
    icon: 'hex',
    enabled: true,
  },
  {
    id: 'qwen-image-3',
    name: 'Qwen Image3',
    description: '擅长复杂版面与精准文字的高质量生图模型',
    tags: ['多参考图', '风格模型'],
    badge: 'NEW',
    category: 'image',
    icon: 'orbit',
    enabled: true,
  },
  {
    id: 'seedream-4-6',
    name: 'Seedream 4.6',
    description: '提升人像一致性、平面设计效果',
    tags: ['超清4K', '组图模式', '多参考图'],
    badge: 'NEW',
    category: 'image',
    icon: 'wave',
    enabled: true,
  },
  {
    id: 'seedream-4-5',
    name: 'Seedream 4.5',
    description: '多角色超强一致性，支持多图融合，语义遵循精准',
    tags: ['超清4K', '组图模式', '多参考图'],
    category: 'image',
    icon: 'wave',
    enabled: true,
  },
  {
    id: 'omni-image-v2',
    name: '全能图片模型V2',
    description: '全能参考生成，更强一致性',
    tags: ['超清4K', '多参考图', '指令编辑强'],
    category: 'image',
    icon: 'hex',
    enabled: true,
  },
  {
    id: 'qwen-image',
    name: 'Qwen-Image',
    description: '中文版面与长文本渲染稳定',
    tags: ['多参考图'],
    category: 'image',
    icon: 'orbit',
    enabled: true,
  },
  {
    id: 'qwen-edit',
    name: 'Qwen-Edit',
    description: '中文指令编辑，局部重绘',
    tags: ['指令编辑强'],
    badge: 'NEW',
    category: 'image',
    icon: 'orbit',
    enabled: true,
  },
  {
    id: 'seedance-2',
    name: 'Seedance 2.0',
    description: '图生视频，支持首尾帧与音频驱动',
    tags: ['首尾帧', '有配音'],
    badge: 'VIP',
    category: 'video',
    icon: 'wave',
    enabled: true,
  },
  {
    id: 'kling-2',
    name: '可灵 2.0',
    description: '运动幅度大，画面稳定',
    tags: ['1080p', '长时长'],
    category: 'video',
    icon: 'hex',
    enabled: true,
  },
  {
    id: 'hailuo-video',
    name: '海螺视频',
    description: '镜头语言自然，人物动作流畅',
    tags: ['720p'],
    category: 'video',
    icon: 'spark',
    enabled: true,
  },
]

export function defaultCatalog(): ModelCatalog {
  return { version: 1, models: DEFAULT_MODELS }
}

export function parseModelCatalog(raw: string | null | undefined): ModelCatalog {
  if (!raw || raw.trim() === '') return defaultCatalog()
  try {
    const parsed = JSON.parse(raw) as Partial<ModelCatalog>
    const list = Array.isArray(parsed.models) ? parsed.models : []
    const models: CatalogModel[] = []
    for (const item of list) {
      if (!item || typeof item !== 'object') continue
      const m = item as Record<string, unknown>
      const name = typeof m.name === 'string' ? m.name.trim() : ''
      if (!name) continue
      const category: ModelCategory = m.category === 'video' ? 'video' : 'image'
      models.push({
        id: typeof m.id === 'string' && m.id ? m.id : `mdl_${name}`,
        name,
        ...(typeof m.description === 'string' && m.description
          ? { description: m.description }
          : {}),
        ...(Array.isArray(m.tags)
          ? { tags: m.tags.filter((t): t is string => typeof t === 'string') }
          : {}),
        ...(typeof m.badge === 'string' && m.badge ? { badge: m.badge } : {}),
        category,
        ...(typeof m.icon === 'string' && m.icon ? { icon: m.icon } : {}),
        enabled: m.enabled !== false,
      })
    }
    return models.length ? { version: 1, models } : defaultCatalog()
  } catch {
    return defaultCatalog()
  }
}

export function serializeModelCatalog(catalog: ModelCatalog): string {
  return JSON.stringify({
    version: 1,
    models: catalog.models.map((m) => ({
      id: m.id,
      name: m.name,
      ...(m.description ? { description: m.description } : {}),
      ...(m.tags?.length ? { tags: m.tags } : {}),
      ...(m.badge ? { badge: m.badge } : {}),
      category: m.category,
      ...(m.icon ? { icon: m.icon } : {}),
      enabled: m.enabled !== false,
    })),
  })
}

/** 供生成器页使用：按类别取启用中的模型 */
export function modelsForCategory(
  catalog: ModelCatalog,
  category: ModelCategory
): CatalogModel[] {
  return catalog.models.filter((m) => m.enabled && m.category === category)
}

export function newModelId(): string {
  return `mdl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
}
