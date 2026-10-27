/*
 * 二开：我的画布列表页（/my-canvases）
 *
 * 列出当前登录用户的画布文档，支持新建、打开编辑器、重命名、删除。
 * 与侧边栏「我的画布」入口互为补充；工作台「+ 新建画布」也是跳进编辑器。
 */
import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Frame, Plus, Trash2, Pencil, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useTranslation } from 'react-i18next'

import {
  useCanvasDocuments,
  useCreateCanvasDocument,
  useDeleteCanvasDocument,
} from './hooks'
import { updateCanvasDocument } from './api'
import type { CanvasDocumentSummary } from './types'

function formatTime(ts: number): string {
  if (!ts) return '—'
  try {
    return new Date(ts * 1000).toLocaleString()
  } catch {
    return '—'
  }
}

export function MyCanvases() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { data, isLoading } = useCanvasDocuments()
  const createMutation = useCreateCanvasDocument()
  const deleteMutation = useDeleteCanvasDocument()

  const [renaming, setRenaming] = useState<CanvasDocumentSummary | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const documents = data ?? []

  const handleCreate = async () => {
    try {
      const doc = await createMutation.mutateAsync({ title: t('Untitled canvas') })
      navigate({ to: '/canvas/$documentId', params: { documentId: String(doc.id) } })
    } catch (e) {
      toast.error(String((e as { message?: string })?.message ?? 'Create failed'))
    }
  }

  const handleDelete = async (doc: CanvasDocumentSummary) => {
    if (!confirm(t('Delete this canvas? This cannot be undone.'))) return
    try {
      await deleteMutation.mutateAsync(doc.id)
      toast.success(t('Canvas deleted'))
    } catch (e) {
      toast.error(String((e as { message?: string })?.message ?? 'Delete failed'))
    }
  }

  const openRename = (doc: CanvasDocumentSummary) => {
    setRenaming(doc)
    setRenameValue(doc.title)
  }

  const submitRename = async () => {
    if (!renaming) return
    const next = renameValue.trim()
    if (!next) {
      toast.error(t('Title cannot be empty'))
      return
    }
    // 直接用 api 保存（避免事件处理器内调用 hook 违反规则）
    try {
      await updateCanvasDocument(renaming.id, { title: next })
      toast.success(t('Renamed'))
      setRenaming(null)
    } catch (e) {
      toast.error(String((e as { message?: string })?.message ?? 'Rename failed'))
    }
  }

  return (
    <div className='mx-auto w-full max-w-5xl px-4 py-8'>
      <div className='mb-6 flex items-center justify-between'>
        <div>
          <h1 className='text-2xl font-semibold'>{t('My Canvases')}</h1>
          <p className='text-muted-foreground text-sm'>
            {t('Your infinite-canvas documents.')}
          </p>
        </div>
        <Button onClick={handleCreate} disabled={createMutation.isPending}>
          <Plus data-icon='inline-start' />
          <span>{t('New canvas')}</span>
        </Button>
      </div>

      {isLoading ? (
        <div className='text-muted-foreground py-12 text-center'>
          {t('Loading…')}
        </div>
      ) : documents.length === 0 ? (
        <div className='border-border flex flex-col items-center gap-3 rounded-xl border border-dashed py-16'>
          <Frame className='text-muted-foreground size-10' />
          <p className='text-muted-foreground'>{t('No canvases yet.')}</p>
          <Button variant='outline' onClick={handleCreate}>
            <Plus data-icon='inline-start' />
            <span>{t('New canvas')}</span>
          </Button>
        </div>
      ) : (
        <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'>
          {documents.map((doc) => (
            <div
              key={doc.id}
              className='border-border bg-card hover:border-primary/50 group rounded-xl border p-4 transition-colors'
            >
              <div className='mb-3 flex items-start justify-between gap-2'>
                <div className='flex min-w-0 items-center gap-2'>
                  <Frame className='text-primary size-5 shrink-0' />
                  <span className='truncate font-medium' title={doc.title}>
                    {doc.title}
                  </span>
                </div>
              </div>
              <p className='text-muted-foreground mb-4 text-xs'>
                {t('Updated')}: {formatTime(doc.updated_at)}
              </p>
              <div className='flex items-center gap-2'>
                <Button
                  size='sm'
                  className='flex-1'
                  onClick={() =>
                    navigate({
                      to: '/canvas/$documentId',
                      params: { documentId: String(doc.id) },
                    })
                  }
                >
                  <ExternalLink data-icon='inline-start' />
                  <span>{t('Open')}</span>
                </Button>
                <Button
                  size='sm'
                  variant='outline'
                  aria-label={t('Rename')}
                  onClick={() => openRename(doc)}
                >
                  <Pencil />
                </Button>
                <Button
                  size='sm'
                  variant='outline'
                  aria-label={t('Delete')}
                  onClick={() => handleDelete(doc)}
                >
                  <Trash2 />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog
        open={!!renaming}
        onOpenChange={(open) => {
          if (!open) setRenaming(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('Rename canvas')}</DialogTitle>
          </DialogHeader>
          <div className='flex flex-col gap-2'>
            <Label htmlFor='rename-canvas'>{t('Title')}</Label>
            <Input
              id='rename-canvas'
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant='outline' onClick={() => setRenaming(null)}>
              {t('Cancel')}
            </Button>
            <Button onClick={submitRename}>{t('Save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
