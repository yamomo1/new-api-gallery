import { api } from '@/lib/api'

import type { GalleryProject, MyWorksParams, WorkSubmit } from './types'

export type { WorkSubmit }

type ApiEnvelope<T> = {
  success: boolean
  message?: string
  data: T
}

// ---------------------------------------------------------------------------
// 项目 / 文件夹
// ---------------------------------------------------------------------------

export async function listGalleryProjects(): Promise<
  ApiEnvelope<GalleryProject[]>
> {
  const res = await api.get('/api/prompt-gallery/v1/projects')
  return res.data
}

export async function createGalleryProject(payload: {
  name: string
  kind?: string
}): Promise<ApiEnvelope<GalleryProject>> {
  const res = await api.post('/api/prompt-gallery/v1/projects', payload)
  return res.data
}

export async function renameGalleryProject(
  id: number,
  name: string
): Promise<ApiEnvelope<null>> {
  const res = await api.put(`/api/prompt-gallery/v1/projects/${id}`, { name })
  return res.data
}

export async function deleteGalleryProject(
  id: number
): Promise<ApiEnvelope<null>> {
  const res = await api.delete(`/api/prompt-gallery/v1/projects/${id}`)
  return res.data
}

// ---------------------------------------------------------------------------
// 我的作品（工作台查询 + 移动分组）
// ---------------------------------------------------------------------------

export async function getMyWorks(
  params: MyWorksParams
): Promise<ApiEnvelope<{ items: import('./types').WorkspaceWork[]; total: number }>> {
  const res = await api.get('/api/prompt-gallery/v1/mine', { params })
  return res.data
}

export async function createMyWork(
  payload: WorkSubmit
): Promise<ApiEnvelope<unknown>> {
  const res = await api.post('/api/prompt-gallery/v1/mine', payload)
  return res.data
}

export async function updateMyWork(
  id: number,
  payload: WorkSubmit
): Promise<ApiEnvelope<null>> {
  const res = await api.put(`/api/prompt-gallery/v1/mine/${id}`, payload)
  return res.data
}

export async function deleteMyWork(id: number): Promise<ApiEnvelope<null>> {
  const res = await api.delete(`/api/prompt-gallery/v1/mine/${id}`)
  return res.data
}

export async function setMyWorkProject(
  id: number,
  projectId: number
): Promise<ApiEnvelope<null>> {
  const res = await api.post(`/api/prompt-gallery/v1/mine/${id}/project`, {
    project_id: projectId,
  })
  return res.data
}
