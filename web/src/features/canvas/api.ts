import { api } from '@/lib/api'

import type {
  CanvasDocument,
  CanvasDocumentSummary,
  CanvasVisibility,
} from './types'

type ApiEnvelope<T> = {
  success: boolean
  message?: string
  data: T
}

export type CanvasDocumentPayload = {
  title?: string
  graph?: string
  description?: string
  visibility?: CanvasVisibility
  thumbnail?: string
}

export async function listCanvasDocuments(): Promise<
  ApiEnvelope<CanvasDocumentSummary[]>
> {
  const res = await api.get('/api/canvas/v1/documents')
  return res.data
}

export async function createCanvasDocument(
  payload: CanvasDocumentPayload
): Promise<ApiEnvelope<CanvasDocument>> {
  const res = await api.post('/api/canvas/v1/documents', payload)
  return res.data
}

export async function getCanvasDocument(
  id: number
): Promise<ApiEnvelope<CanvasDocument>> {
  const res = await api.get(`/api/canvas/v1/documents/${id}`)
  return res.data
}

export async function updateCanvasDocument(
  id: number,
  payload: CanvasDocumentPayload
): Promise<ApiEnvelope<null>> {
  const res = await api.put(`/api/canvas/v1/documents/${id}`, payload)
  return res.data
}

export async function deleteCanvasDocument(
  id: number
): Promise<ApiEnvelope<null>> {
  const res = await api.delete(`/api/canvas/v1/documents/${id}`)
  return res.data
}
