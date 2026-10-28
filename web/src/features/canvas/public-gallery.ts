/*
 * 二开：公开画布画廊（免登录）
 * ------------------------------------------------------------------
 * 对应后端 GET /api/canvas/v1/gallery（只返回 visibility=public 的文档，
 * 且不含 graph 体）。首页「画布广场」用它取数据。
 */
import { useQuery } from '@tanstack/react-query'

export type PublicCanvasSummary = {
  id: number
  user_id: number
  title: string
  description: string
  visibility: 'public' | 'private' | 'unlist'
  thumbnail: string
  author: string
  created_at: number
  updated_at: number
}

type GalleryResponse = {
  data?: {
    items?: PublicCanvasSummary[]
    total?: number
  }
}

async function fetchPublicCanvases(
  limit: number
): Promise<PublicCanvasSummary[]> {
  const res = await fetch(
    `/api/canvas/v1/gallery?offset=0&limit=${Math.min(Math.max(limit, 1), 24)}`,
    { headers: { Accept: 'application/json' } }
  )
  if (!res.ok) throw new Error(`canvas gallery ${res.status}`)
  const body = (await res.json()) as GalleryResponse
  const items = body?.data?.items
  return Array.isArray(items) ? items : []
}

/** 首页画布广场数据：失败/为空时返回空数组（区块自动隐藏） */
export function usePublicCanvases(limit = 8) {
  const { data, isLoading } = useQuery({
    queryKey: ['canvas', 'public-gallery', limit],
    queryFn: () => fetchPublicCanvases(limit),
    staleTime: 60 * 1000,
    retry: 1,
  })
  return { items: data ?? [], isLoading }
}
