import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import i18next from 'i18next'

import { requireServerSuccess } from '@/lib/server-error-message'

import {
  adminDeletePromptGallery,
  adminSetPromptGalleryHome,
  adminSetPromptGalleryStatus,
  adminUpdatePromptGallery,
  createGalleryComment,
  createMyPromptGallery,
  deleteGalleryComment,
  deleteMyPromptGallery,
  getGalleryComments,
  getAdminPromptGalleries,
  getGalleryAuthor,
  getMyPromptGalleryFavorites,
  getMyPromptGalleries,
  getPromptGalleryFacets,
  getPromptGalleryList,
  likeGalleryComment,
  likePromptGallery,
  toggleGalleryAuthorFollow,
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

/** 作者卡统计（未登录也能看；following 恒为 false） */
export function useGalleryAuthor(authorId?: number) {
  const enabled = Number.isFinite(authorId) && (authorId ?? 0) > 0
  return useQuery({
    queryKey: ['prompt-gallery', 'author', authorId],
    queryFn: async () =>
      requireServerSuccess(await getGalleryAuthor(authorId as number)).data,
    enabled,
    staleTime: 60 * 1000,
  })
}

/** 关注 / 取关作者（登录用户），成功后刷新作者统计里的粉丝数与关注态 */
export function useToggleGalleryAuthorFollow() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (authorId: number) =>
      requireServerSuccess(await toggleGalleryAuthorFollow(authorId)).data,
    onSuccess: (_data, authorId) => {
      queryClient.invalidateQueries({
        queryKey: ['prompt-gallery', 'author', authorId],
      })
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

// ----------------------------------------------------------------------------
// 作品评论
// ----------------------------------------------------------------------------

/** 评论列表（公开）；发表/删除后 invalidate 这份缓存与详情里的评论数 */
export function useGalleryComments(
  galleryId: number,
  sort: 'latest' | 'popular' = 'latest'
) {
  return useQuery({
    queryKey: ['gallery-comments', galleryId, sort],
    queryFn: async () =>
      requireServerSuccess(
        await getGalleryComments(galleryId, { limit: 50, sort })
      ).data,
    staleTime: 30 * 1000,
    enabled: galleryId > 0,
  })
}

/** 评论点赞：只更新数字，不整页刷新 */
export function useLikeGalleryComment(galleryId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (commentId: number) =>
      requireServerSuccess(await likeGalleryComment(commentId)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gallery-comments', galleryId] })
    },
  })
}

export function useCreateGalleryComment(galleryId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (content: string) =>
      requireServerSuccess(await createGalleryComment(galleryId, content)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gallery-comments', galleryId] })
      queryClient.invalidateQueries({
        queryKey: ['prompt-gallery', 'detail', galleryId],
      })
    },
  })
}

export function useDeleteGalleryComment(galleryId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (commentId: number) =>
      requireServerSuccess(await deleteGalleryComment(commentId)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gallery-comments', galleryId] })
      queryClient.invalidateQueries({
        queryKey: ['prompt-gallery', 'detail', galleryId],
      })
      toast.success(i18next.t('Comment deleted'))
    },
  })
}
