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
