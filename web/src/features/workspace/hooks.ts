import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import i18next from 'i18next'

import { requireServerSuccess } from '@/lib/server-error-message'

import {
  createGalleryProject,
  createMyWork,
  deleteGalleryProject,
  deleteMyWork,
  getMyWorks,
  listGalleryProjects,
  renameGalleryProject,
  setMyWorkProject,
  updateMyWork,
  type WorkSubmit,
} from './api'
import type { MyWorksParams } from './types'

export function useGalleryProjects() {
  return useQuery({
    queryKey: ['workspace', 'projects'],
    queryFn: async () =>
      requireServerSuccess(await listGalleryProjects()).data,
    staleTime: 30 * 1000,
  })
}

export function useMyWorks(params: MyWorksParams) {
  return useQuery({
    queryKey: ['workspace', 'works', params],
    queryFn: async () => requireServerSuccess(await getMyWorks(params)).data,
    staleTime: 30 * 1000,
  })
}

function invalidateWorkspace(
  queryClient: ReturnType<typeof useQueryClient>
) {
  queryClient.invalidateQueries({ queryKey: ['workspace'] })
  queryClient.invalidateQueries({ queryKey: ['prompt-gallery'] })
}

export function useCreateGalleryProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { name: string; kind?: string }) =>
      requireServerSuccess(await createGalleryProject(payload)).data,
    onSuccess: () => {
      invalidateWorkspace(queryClient)
      toast.success(i18next.t('Project created'))
    },
  })
}

export function useRenameGalleryProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, name }: { id: number; name: string }) =>
      requireServerSuccess(await renameGalleryProject(id, name)).data,
    onSuccess: () => {
      invalidateWorkspace(queryClient)
      toast.success(i18next.t('Updated'))
    },
  })
}

export function useDeleteGalleryProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) =>
      requireServerSuccess(await deleteGalleryProject(id)).data,
    onSuccess: () => {
      invalidateWorkspace(queryClient)
      toast.success(i18next.t('Deleted'))
    },
  })
}

export function useCreateMyWork() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: WorkSubmit) =>
      requireServerSuccess(await createMyWork(payload)).data,
    onSuccess: () => {
      invalidateWorkspace(queryClient)
      toast.success(i18next.t('Work added'))
    },
  })
}

export function useUpdateMyWork() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: WorkSubmit }) =>
      requireServerSuccess(await updateMyWork(id, payload)).data,
    onSuccess: () => {
      invalidateWorkspace(queryClient)
      toast.success(i18next.t('Updated'))
    },
  })
}

export function useDeleteMyWork() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) =>
      requireServerSuccess(await deleteMyWork(id)).data,
    onSuccess: () => {
      invalidateWorkspace(queryClient)
      toast.success(i18next.t('Deleted'))
    },
  })
}

export function useSetMyWorkProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, projectId }: { id: number; projectId: number }) =>
      requireServerSuccess(await setMyWorkProject(id, projectId)).data,
    onSuccess: () => {
      invalidateWorkspace(queryClient)
      toast.success(i18next.t('Moved'))
    },
  })
}
