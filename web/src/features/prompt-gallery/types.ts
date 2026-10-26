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
}
