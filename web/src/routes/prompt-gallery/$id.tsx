import { createFileRoute } from '@tanstack/react-router'

import { PromptGalleryDetailPage } from '@/features/prompt-gallery/detail-page'

/**
 * 提示词详情页：/prompt-gallery/:id
 *
 * 真路由（而不是列表页弹窗）才能让每条提示词被搜索引擎独立收录 ——
 * 首屏标题/描述/封面/结构化数据由 Go 侧 service/seo 直接注入 HTML。
 */
export const Route = createFileRoute('/prompt-gallery/$id')({
  component: PromptGalleryDetailRoute,
})

function PromptGalleryDetailRoute() {
  const { id } = Route.useParams()
  return <PromptGalleryDetailPage id={Number(id)} />
}
