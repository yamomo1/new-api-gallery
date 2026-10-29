import { api } from '@/lib/http-client'

export interface StorageUploadResponse {
  success: boolean
  message?: string
  data?: string
}

// 调用全站通用上传接口，返回可访问的图片 URL。
// 走主站 axios 实例，自动携带登录态（Bearer / Cookie）。
export async function uploadImage(
  file: File,
  signal?: AbortSignal,
): Promise<string> {
  const form = new FormData()
  form.append('file', file)

  const res = await api.post<StorageUploadResponse>(
    '/api/storage/upload',
    form,
    { signal },
  )
  const data = res.data
  if (!data?.success || !data.data) {
    throw new Error(data?.message || 'Upload failed')
  }
  return data.data
}
