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
}

export type PromptGalleryListParams = {
  category?: string
  search?: string
  type?: PromptGalleryType
  model?: string
  sort?: PromptGallerySort
  offset?: number
  limit?: number
}

export type PromptGalleryListResult = {
  items: PromptGalleryItem[]
  total: number
  offset: number
  limit: number
  /** 后台列表附带的可选模型/分类（全量，不限审核状态） */
  facets?: { models: string[]; categories: string[] }
}

/** 后台审核列表的筛选条件 */
export type PromptGalleryAdminParams = {
  status?: PromptGalleryStatus
  type?: PromptGalleryType
  model?: string
  category?: string
  search?: string
  sort?: 'newest' | 'oldest' | 'views' | 'likes'
  offset?: number
  limit?: number
}
