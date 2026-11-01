/*
 * 读取后台模型目录（Option `GalleryModelCatalog` → /api/status）
 */
import { useMemo } from 'react'

import { useStatus } from '@/hooks/use-status'
import {
  modelsForCategory,
  parseModelCatalog,
  type CatalogModel,
  type ModelCategory,
  type ModelCatalog,
} from '@/lib/model-catalog'

export function useModelCatalog(): {
  catalog: ModelCatalog
  imageModels: CatalogModel[]
  videoModels: CatalogModel[]
} {
  const { status } = useStatus()
  const raw = status?.GalleryModelCatalog as string | null | undefined

  return useMemo(() => {
    const catalog = parseModelCatalog(raw)
    return {
      catalog,
      imageModels: modelsForCategory(catalog, 'image'),
      videoModels: modelsForCategory(catalog, 'video'),
    }
  }, [raw])
}

export function useModelsByCategory(category: ModelCategory): CatalogModel[] {
  const { imageModels, videoModels } = useModelCatalog()
  return category === 'video' ? videoModels : imageModels
}
