import { api } from '@/lib/api'

import type {
  PromptGalleryAdminParams,
  PromptGalleryFacets,
  PromptGalleryItem,
  PromptGalleryListParams,
  PromptGalleryListResult,
  PromptGalleryStatus,
} from './types'

type ApiEnvelope<T> = {
  success: boolean
  message?: string
  data: T
}

export async function getPromptGalleryList(
  params: PromptGalleryListParams
): Promise<ApiEnvelope<PromptGalleryListResult>> {
  const res = await api.get('/api/prompt-gallery/v1/prompts', { params })
  return res.data
}

export async function getPromptGalleryDetail(
  id: number
): Promise<ApiEnvelope<PromptGalleryItem>> {
  const res = await api.get(`/api/prompt-gallery/v1/prompts/${id}`)
  return res.data
}

export async function getPromptGalleryFacets(): Promise<
  ApiEnvelope<PromptGalleryFacets>
> {
  const res = await api.get('/api/prompt-gallery/v1/facets')
  return res.data
}

export async function getMyPromptGalleries(
  params: PromptGalleryListParams
): Promise<ApiEnvelope<PromptGalleryListResult>> {
  const res = await api.get('/api/prompt-gallery/v1/mine', { params })
  return res.data
}

export type PromptGallerySubmit = {
  title: string
  prompt: string
  model: string
  type: string
  cover: string
  media: string
  category: string
  tags: string
}

export async function createMyPromptGallery(
  payload: PromptGallerySubmit
): Promise<ApiEnvelope<PromptGalleryItem>> {
  const res = await api.post('/api/prompt-gallery/v1/mine', payload)
  return res.data
}

export async function updateMyPromptGallery(
  id: number,
  payload: PromptGallerySubmit
): Promise<ApiEnvelope<null>> {
  const res = await api.put(`/api/prompt-gallery/v1/mine/${id}`, payload)
  return res.data
}

export async function deleteMyPromptGallery(
  id: number
): Promise<ApiEnvelope<null>> {
  const res = await api.delete(`/api/prompt-gallery/v1/mine/${id}`)
  return res.data
}

export async function adminSetPromptGalleryStatus(
  id: number,
  status: PromptGalleryStatus
): Promise<ApiEnvelope<null>> {
  const res = await api.post(
    `/api/prompt-gallery/v1/admin/prompts/${id}/status`,
    { status }
  )
  return res.data
}

export async function adminUpdatePromptGallery(
  id: number,
  payload: PromptGallerySubmit
): Promise<ApiEnvelope<null>> {
  const res = await api.put(`/api/prompt-gallery/v1/admin/prompts/${id}`, payload)
  return res.data
}

export async function adminDeletePromptGallery(
  id: number
): Promise<ApiEnvelope<null>> {
  const res = await api.delete(`/api/prompt-gallery/v1/admin/prompts/${id}`)
  return res.data
}

export async function adminSetPromptGalleryHome(
  id: number,
  home: boolean
): Promise<ApiEnvelope<null>> {
  const res = await api.post(
    `/api/prompt-gallery/v1/admin/prompts/${id}/home`,
    { home }
  )
  return res.data
}

export async function getAdminPromptGalleries(
  params: PromptGalleryAdminParams
): Promise<ApiEnvelope<PromptGalleryListResult>> {
  const res = await api.get('/api/prompt-gallery/v1/admin/prompts', { params })
  return res.data
}
