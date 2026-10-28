import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import i18next from 'i18next'

import { requireServerSuccess } from '@/lib/server-error-message'

import {
  adminDeletePromptGallery,
  adminSetPromptGalleryHome,
  adminSetPromptGalleryStatus,
  adminUpdatePromptGallery,
  createMyPromptGallery,
  deleteMyPromptGallery,
  getAdminPromptGalleries,
  getMyPromptGalleryFavorites,
  getMyPromptGalleries,
  getPromptGalleryFacets,
  getPromptGalleryList,
  likePromptGallery,
  togglePromptGalleryFavorite,
  updateMyPromptGallery,
  type PromptGallerySubmit,
} from '../api'
import type {
  PromptGalleryAdminParams,
  PromptGalleryFacets,
  PromptGalleryListParams,
  PromptGalleryListResult,
  PromptGalleryStatus,
} from '../types'

export function usePromptGalleryList(params: PromptGalleryListParams) {
  return useQuery({
    queryKey: ['prompt-gallery', 'list', params],
    queryFn: async () =>
      requireServerSuccess(await getPromptGalleryList(params)).data,
    staleTime: 60 * 1000,
  })
}

export function usePromptGalleryFacets() {
  return useQuery({
    queryKey: ['prompt-gallery', 'facets'],
    queryFn: async () =>
      requireServerSuccess(await getPromptGalleryFacets()).data,
    staleTime: 5 * 60 * 1000,
  })
}

/** 公开点赞 +1（本地 localStorage 防重复，服务端不校验） */
export function useLikePromptGallery() {
  return useMutation({
    mutationFn: async (id: number) =>
      requireServerSuccess(await likePromptGallery(id)).data,
  })
}

/** 我收藏的作品（登录后可用；画布素材面板共用同一接口） */
export function useMyPromptGalleryFavorites(enabled: boolean) {
  return useQuery({
    queryKey: ['prompt-gallery', 'favorites'],
    queryFn: async () =>
      requireServerSuccess(await getMyPromptGalleryFavorites({ limit: 200 }))
        .data,
    enabled,
    staleTime: 60 * 1000,
  })
}

/** 收藏 / 取消收藏：落库后画布素材面板即可看到 */
export function useTogglePromptGalleryFavorite() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) =>
      requireServerSuccess(await togglePromptGalleryFavorite(id)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prompt-gallery', 'favorites'] })
    },
  })
}

export function useMyPromptGalleries(params: PromptGalleryListParams) {  return useQuery({
    queryKey: ['prompt-gallery', 'mine', params],
    queryFn: async () =>
      requireServerSuccess(await getMyPromptGalleries(params)).data,
    staleTime: 30 * 1000,
  })
}

function invalidateGallery(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['prompt-gallery'] })
}

export function useCreatePromptGallery() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: PromptGallerySubmit) =>
      requireServerSuccess(await createMyPromptGallery(payload)).data,
    onSuccess: () => {
      invalidateGallery(queryClient)
      toast.success(i18next.t('Submitted for review'))
    },
  })
}

export function useUpdatePromptGallery() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: number
      payload: PromptGallerySubmit
    }) => requireServerSuccess(await updateMyPromptGallery(id, payload)).data,
    onSuccess: () => {
      invalidateGallery(queryClient)
      toast.success(i18next.t('Updated'))
    },
  })
}

export function useDeletePromptGallery() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) =>
      requireServerSuccess(await deleteMyPromptGallery(id)).data,
    onSuccess: () => {
      invalidateGallery(queryClient)
      toast.success(i18next.t('Deleted'))
    },
  })
}

export function useAdminPromptGalleries(params: PromptGalleryAdminParams) {
  return useQuery({
    queryKey: ['prompt-gallery', 'admin', params],
    queryFn: async () =>
      requireServerSuccess(await getAdminPromptGalleries(params)).data,
    staleTime: 15 * 1000,
  })
}

export function useAdminSetPromptGalleryStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: number
      status: PromptGalleryStatus
    }) => requireServerSuccess(await adminSetPromptGalleryStatus(id, status)).data,
    onSuccess: () => {
      invalidateGallery(queryClient)
      toast.success(i18next.t('Status updated'))
    },
  })
}

export function useAdminUpdatePromptGallery() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: number
      payload: PromptGallerySubmit
    }) => requireServerSuccess(await adminUpdatePromptGallery(id, payload)).data,
    onSuccess: () => {
      invalidateGallery(queryClient)
      toast.success(i18next.t('Updated'))
    },
  })
}

export function useAdminDeletePromptGallery() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) =>
      requireServerSuccess(await adminDeletePromptGallery(id)).data,
    onSuccess: () => {
      invalidateGallery(queryClient)
      toast.success(i18next.t('Deleted'))
    },
  })
}

export function useAdminSetPromptGalleryHome() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, home }: { id: number; home: boolean }) =>
      requireServerSuccess(await adminSetPromptGalleryHome(id, home)).data,
    onSuccess: (_data, vars) => {
      invalidateGallery(queryClient)
      toast.success(
        i18next.t(vars.home ? 'Shown on homepage' : 'Removed from homepage')
      )
    },
  })
}

export type PromptGalleryListData = PromptGalleryListResult
export type PromptGalleryFacetsData = PromptGalleryFacets
