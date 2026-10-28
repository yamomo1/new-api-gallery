/*
 * 二开：站内画布入口 → 开源画布工作台跳转页
 * ------------------------------------------------------------------
 * New API 前端不再自带画布编辑器，/canvas 与 /canvas/:id 统一跳到
 * 独立部署的 infinite-canvas 工作台：
 *   /canvas        → <studio>/canvas
 *   /canvas/:id    → <studio>/canvas?open=<id>
 *
 * 跳转用 location.replace，浏览器「后退」可直接回到画廊，不会堆历史记录。
 * 未配置工作台地址（CANVAS_STUDIO_URL 为空）时展示兜底说明，避免白屏。
 */
import { useEffect } from 'react'
import { Link } from '@tanstack/react-router'
import { Frame } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'

import {
  canvasStudioHomeUrl,
  canvasStudioUrl,
} from './studio'

export function CanvasStudioRedirect({ documentId }: { documentId?: number }) {
  const { t } = useTranslation()
  const target =
    documentId && Number.isInteger(documentId) && documentId > 0
      ? canvasStudioUrl(documentId)
      : canvasStudioHomeUrl()

  useEffect(() => {
    if (!target) return
    window.location.replace(target)
  }, [target])

  return (
    <div className='flex h-full flex-col items-center justify-center gap-4 p-6 text-center'>
      <Frame className='text-muted-foreground h-12 w-12' />
      {target ? (
        <>
          <p className='text-muted-foreground'>{t('Opening the canvas studio…')}</p>
          <Button variant='outline' onClick={() => window.location.replace(target)}>
            {t('Open manually')}
          </Button>
        </>
      ) : (
        <>
          <p className='text-muted-foreground'>
            {t('The canvas studio URL is not configured yet.')}
          </p>
          <p className='text-muted-foreground text-xs'>
            {t('Set VITE_CANVAS_STUDIO_URL or edit features/canvas/studio.ts.')}
          </p>
          <Button variant='outline' render={<Link to='/my-canvases' />}>
            {t('Back')}
          </Button>
        </>
      )}
    </div>
  )
}
