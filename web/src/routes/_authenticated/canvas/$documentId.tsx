import { Link, createFileRoute } from '@tanstack/react-router'
import { FileWarning } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'

// 二开：无限画布编辑器（对标 api.seedance.nz/canvas/:id）
import { CanvasEditor } from '@/features/canvas/canvas-editor'

export const Route = createFileRoute('/_authenticated/canvas/$documentId')({
  component: CanvasDocumentRoute,
})

function CanvasDocumentRoute() {
  const { t } = useTranslation()
  const { documentId } = Route.useParams()
  const id = Number(documentId)

  if (!Number.isInteger(id) || id <= 0) {
    return (
      <div className='flex h-full flex-col items-center justify-center gap-4 p-6 text-center'>
        <FileWarning className='text-muted-foreground h-12 w-12' />
        <p className='text-muted-foreground'>{t('Canvas not found')}</p>
        <Button variant='outline' render={<Link to='/workspace' />}>
          {t('Back')}
        </Button>
      </div>
    )
  }

  return <CanvasEditor documentId={id} />
}
