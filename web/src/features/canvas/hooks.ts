import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { requireServerSuccess } from '@/lib/server-error-message'

import {
  createCanvasDocument,
  deleteCanvasDocument,
  getCanvasDocument,
  listCanvasDocuments,
  updateCanvasDocument,
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
    },
  })
}
