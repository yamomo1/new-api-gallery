// ----------------------------------------------------------------------------
// Prompt Gallery types
// ----------------------------------------------------------------------------
//
// 画廊条目与后端 /api/prompt-gallery/v1/* 契约对齐（二开新增模块）。

export type PromptGalleryType = 'image' | 'video'

export type PromptGallerySort =
  | 'related'
  | 'latest'
  | 'featured'
  | 'popular'

export type PromptGalleryStatus = 'draft' | 'published' | 'rejected'

export type PromptGalleryItem = {
  id: number
  title: string
  prompt: string
  /** 英文版提示词（可选）：详情弹窗「英文/中文」双语 Tab 数据源 */
  prompt_en?: string
  model: string
  type: PromptGalleryType
  cover: string
  /** JSON 数组字符串，多张图 / 多段视频 */
  media: string
  category: string
  tags: string
  author_id: number
  author: string
  likes: number
  views: number
  status: PromptGalleryStatus
  /** 后台「首页显示」标记：勾选后置顶到首页 03 画廊的自动来源 */
  home: boolean
  /** ComfyUI 工作流 JSON（API 格式）；空串 = 未配置 */
  workflow_json?: string
  /** 模型来源清单（JSON 数组字符串）；type=quark/netdisk 用于网盘手动下载 */
  model_sources?: string
  /** RunningHub 云端工作流 ID；空串 = 未配置 */
  runninghub_workflow_id?: string
  created_at: number
  updated_at: number
}

export type PromptGalleryFacets = {
  categories: string[]
  models: string[]
  types: string[]
  tags?: string[]
}

export type PromptGalleryListParams = {
  category?: string
  search?: string
  type?: PromptGalleryType
  model?: string
  tag?: string
  sort?: PromptGallerySort
  offset?: number
  limit?: number
}

export type PromptGalleryListResult = {
  items: PromptGalleryItem[]
  total: number
  offset: number
  limit: number
  /** 后台列表附带的可选模型/分类/标签（全量，不限审核状态） */
  facets?: { models: string[]; categories: string[]; tags?: string[] }
}

/** 后台审核列表的筛选条件 */export type PromptGalleryAdminParams = {
  status?: PromptGalleryStatus
  type?: PromptGalleryType
  model?: string
  category?: string
  search?: string
  sort?: 'newest' | 'oldest' | 'views' | 'likes'
  offset?: number
  limit?: number
}

/** 我收藏的作品（登录用户；画布素材面板共用同一接口） */
export type PromptGalleryFavoritesResult = {
  items: PromptGalleryItem[]
  total: number
  /** 收藏的作品 ID（新→旧），画廊页用来点亮星标 */
  ids: number[]
  offset: number
  limit: number
}

export type PromptGalleryFavoriteToggleResult = {
  favorited: boolean
  total: number
}

// ----------------------------------------------------------------------------
// 「去创作」四个功能（二开）
// ----------------------------------------------------------------------------

/** 后台四个功能开关；对应 Option `GalleryCreateConfig` */
export type GalleryCreateConfig = {
  /** 网盘手动下载：展示模型网盘分享链接，客户自行下载 */
  netdisk_download: boolean
  /** ComfyUI 自定义节点一键生图：唤起本地 ComfyUI 自动下模型/加载工作流 */
  comfyui_node: boolean
  /** RunningHub 云端 ComfyUI：跳转云端工作流体验页 */
  runninghub: boolean
  /** 手动下载工作流 JSON / 拖入本地 ComfyUI（零安装） */
  manual_workflow: boolean
}

/** 模型来源单项（与后端 controller.ModelSource 对齐） */
export type GalleryModelSource = {
  /** huggingface / civitai / oss / quark / netdisk 等 */
  type: string
  name: string
  url: string
  /** 目标子目录（ComfyUI models 下），如 checkpoints / loras / vae */
  dir?: string
  sha256?: string
}

/** 「去创作」数据包：工作流 + 模型来源 + RunningHub 工作流 ID */
export type GalleryCreatePayload = {
  gallery_id: number
  title: string
  prompt: string
  workflow_json: string
  model_sources: GalleryModelSource[]
  runninghub_workflow_id: string
}
