// ----------------------------------------------------------------------------
// Workspace types（工作台 /canvas 对标页）
// ----------------------------------------------------------------------------
//
// 与后端 /api/prompt-gallery/v1/projects、/mine 契约对齐（二开新增）。

export type GalleryProjectKind = 'project' | 'folder'

export type GalleryProject = {
  id: number
  user_id: number
  name: string
  kind: GalleryProjectKind
  cover: string
  created_at: number
  updated_at: number
}

export type WorkspaceWork = {
  id: number
  title: string
  prompt: string
  model: string
  type: 'image' | 'video'
  cover: string
  /** JSON 数组字符串，多张图 / 多段视频 */
  media: string
  category: string
  tags: string
  author_id: number
  author: string
  likes: number
  views: number
  status: 'draft' | 'published' | 'rejected'
  home: boolean
  project_id: number
  created_at: number
  updated_at: number
}

/** 筛选维度的组合键：all=全部 / folder=文件夹 / project=项目 / image / video */
export type WorkspaceFilter = 'all' | 'folder' | 'project' | 'image' | 'video'
/** 作品排序：latest 新→旧 / oldest 旧→新 */
export type WorkspaceSort = 'latest' | 'oldest'

export type MyWorksParams = {
  type?: string
  search?: string
  sort?: WorkspaceSort
  /** -1 不过滤；0=未分组；>0 按项目 id */
  project_id?: number
  offset?: number
  limit?: number
}

export type WorkSubmit = {
  title: string
  prompt: string
  model: string
  type: string
  cover: string
  media: string
  category: string
  tags: string
  project_id: number
}
