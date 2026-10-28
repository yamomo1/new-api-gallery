import { createFileRoute } from '@tanstack/react-router'

// 二开：/canvas/:id → 开源画布工作台 <studio>/canvas?open=<id>
// 保留这条路由是为了让旧链接（我的画布 / 工作台「新建画布」/ 历史书签）
// 继续可用，不再渲染站内自研编辑器。
import { CanvasStudioRedirect } from '@/features/canvas/studio-redirect'

export const Route = createFileRoute('/_authenticated/canvas/$documentId')({
  component: CanvasDocumentRoute,
})

function CanvasDocumentRoute() {
  const { documentId } = Route.useParams()
  return <CanvasStudioRedirect documentId={Number(documentId)} />
}
