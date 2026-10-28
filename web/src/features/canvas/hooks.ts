import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { requireServerSuccess } from '@/lib/server-error-message'

import {
  createCanvasDocument,
  deleteCanvasDocument,
  getCanvasDocument,
  listCanvasDocuments,
  updateCanvasDocument,
  type CanvasDocumentPayload,
} from './api'

export function useCanvasDocuments() {
  return useQuery({
    queryKey: ['canvas', 'documents'],
    queryFn: async () => requireServerSuccess(await listCanvasDocuments()).data,
    staleTime: 30 * 1000,
  })
}

export function useCanvasDocument(id: number) {
  return useQuery({
    queryKey: ['canvas', 'document', id],
    queryFn: async () => requireServerSuccess(await getCanvasDocument(id)).data,
    enabled: Number.isInteger(id) && id > 0,
    staleTime: 10 * 1000,
  })
}

export function useSaveCanvasDocument(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { title?: string; graph?: string }) => {
      requireServerSuccess(await updateCanvasDocument(id, payload))
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['canvas', 'document', id],
      })
      void queryClient.invalidateQueries({ queryKey: ['canvas', 'documents'] })
    },
    onError: (error) => {
      toast.error(String(error?.message ?? 'Save failed'))
    },
  })
}

export function useCreateCanvasDocument() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { title?: string; graph?: string }) =>
      requireServerSuccess(await createCanvasDocument(payload)).data,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['canvas', 'documents'] })
    },
  })
}

export function useDeleteCanvasDocument() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      requireServerSuccess(await deleteCanvasDocument(id))
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['canvas', 'documents'] })
      void queryClient.invalidateQueries({
        queryKey: ['canvas', 'public-gallery'],
      })
    },
  })
}

/** 改标题 / 可见性 / 描述等元信息（列表页用，改完同时刷新公开画廊） */
export function useUpdateCanvasDocumentMeta() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: number
      payload: CanvasDocumentPayload
    }) => {
      requireServerSuccess(await updateCanvasDocument(id, payload))
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['canvas', 'documents'] })
      void queryClient.invalidateQueries({
        queryKey: ['canvas', 'public-gallery'],
      })
    },
  })
}
