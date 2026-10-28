/*
 * 二开：我的画布列表页（/my-canvases）
 *
 * 列出当前登录用户的画布文档，支持新建、打开编辑器、重命名、删除；
 * Phase 4 起还可以把画布「发布」到首页画布广场（visibility=public），
 * 以及跳转到独立的画布工作台（infinite-canvas）继续编辑。
 */
import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  ExternalLink,
  Frame,
  Globe2,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'
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
  useUpdateCanvasDocumentMeta,
} from './hooks'
import { CANVAS_STUDIO_URL, canvasStudioUrl } from './studio'
import type { CanvasDocumentSummary, CanvasVisibility } from './types'

function formatTime(ts: number): string {
  if (!ts) return '—'
  try {
    return new Date(ts * 1000).toLocaleString()
  } catch {
    return '—'
  }
}

/** 标题哈希 → 固定色相，没有封面时也有稳定且不撞色的占位 */
function hueOf(seed: string): number {
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 360
  }
  return hash
}

const VISIBILITY_VALUES: CanvasVisibility[] = ['private', 'public', 'unlist']

export function MyCanvases() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { data, isLoading } = useCanvasDocuments()
  const createMutation = useCreateCanvasDocument()
  const deleteMutation = useDeleteCanvasDocument()
  const updateMutation = useUpdateCanvasDocumentMeta()

  const [renaming, setRenaming] = useState<CanvasDocumentSummary | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [busyId, setBusyId] = useState<number | null>(null)

  const documents = data ?? []

  const handleCreate = async () => {
    try {
      const doc = await createMutation.mutateAsync({
        title: t('Untitled canvas'),
      })
      navigate({
        to: '/canvas/$documentId',
        params: { documentId: String(doc.id) },
      })
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

  const handleVisibility = async (
    doc: CanvasDocumentSummary,
    visibility: CanvasVisibility
  ) => {
    if ((doc.visibility ?? 'private') === visibility) return
    setBusyId(doc.id)
    try {
      await updateMutation.mutateAsync({ id: doc.id, payload: { visibility } })
      toast.success(
        visibility === 'public'
          ? t('Published to the gallery')
          : t('Visibility updated')
      )
    } catch (e) {
      toast.error(
        String((e as { message?: string })?.message ?? 'Update failed')
      )
    } finally {
      setBusyId(null)
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
    try {
      await updateMutation.mutateAsync({
        id: renaming.id,
        payload: { title: next },
      })
      toast.success(t('Renamed'))
      setRenaming(null)
    } catch (e) {
      toast.error(String((e as { message?: string })?.message ?? 'Rename failed'))
    }
  }

  return (
    <div className='mx-auto w-full max-w-6xl px-4 py-8'>
      <div className='mb-6 flex flex-wrap items-end justify-between gap-3'>
        <div>
          <h1 className='text-2xl font-semibold'>{t('My Canvases')}</h1>
          <p className='text-muted-foreground text-sm'>
            {t('Your infinite-canvas documents.')}
          </p>
        </div>
        <div className='flex items-center gap-2'>
          {CANVAS_STUDIO_URL && (
            <Button
              variant='outline'
              onClick={() =>
                window.open(CANVAS_STUDIO_URL, '_blank', 'noopener,noreferrer')
              }
            >
              <Globe2 data-icon='inline-start' />
              <span>{t('Canvas studio')}</span>
            </Button>
          )}
          <Button onClick={handleCreate} disabled={createMutation.isPending}>
            <Plus data-icon='inline-start' />
            <span>{t('New canvas')}</span>
          </Button>
        </div>
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
          {documents.map((doc) => {
            const studioUrl = canvasStudioUrl(doc.id)
            const isPublic = (doc.visibility ?? 'private') === 'public'
            return (
              <div
                key={doc.id}
                className='border-border bg-card hover:border-primary/50 group flex flex-col overflow-hidden rounded-xl border transition-colors'
              >
                {/* 封面：有缩略图用图，否则按标题色相生成渐变占位 */}
                <div className='relative aspect-[4/3] overflow-hidden'>
                  {doc.thumbnail ? (
                    <img
                      src={doc.thumbnail}
                      alt={doc.title}
                      className='h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]'
                      loading='lazy'
                    />
                  ) : (
                    <div
                      className='flex h-full w-full items-center justify-center'
                      style={{
                        background: `linear-gradient(150deg, hsl(${hueOf(doc.title)} 58% 90%), hsl(${hueOf(doc.title) + 30} 52% 84%))`,
                      }}
                    >
                      <Frame
                        className='size-8'
                        style={{ color: `hsl(${hueOf(doc.title)} 45% 40%)` }}
                      />
                    </div>
                  )}
                  {isPublic && (
                    <span className='bg-background/85 absolute left-2 top-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium backdrop-blur'>
                      <Globe2 className='size-3' />
                      {t('Public')}
                    </span>
                  )}
                </div>

                <div className='flex flex-1 flex-col gap-2 p-4'>
                  <div className='flex items-start justify-between gap-2'>
                    <span className='truncate font-medium' title={doc.title}>
                      {doc.title}
                    </span>
                  </div>
                  {doc.description && (
                    <p className='text-muted-foreground line-clamp-2 text-xs'>
                      {doc.description}
                    </p>
                  )}
                  <p className='text-muted-foreground text-xs'>
                    {t('Updated')}: {formatTime(doc.updated_at)}
                  </p>

                  <div className='mt-auto flex items-center gap-2 pt-2'>
                    <select
                      aria-label={t('Visibility')}
                      className='border-border bg-background h-8 rounded-md border px-2 text-xs'
                      value={doc.visibility ?? 'private'}
                      disabled={busyId === doc.id}
                      onChange={(event) =>
                        void handleVisibility(
                          doc,
                          event.target.value as CanvasVisibility
                        )
                      }
                    >
                      {VISIBILITY_VALUES.map((value) => (
                        <option key={value} value={value}>
                          {t(
                            value === 'public'
                              ? 'Public'
                              : value === 'unlist'
                                ? 'Unlisted'
                                : 'Private'
                          )}
                        </option>
                      ))}
                    </select>

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

                    {studioUrl && (
                      <Button
                        size='sm'
                        variant='outline'
                        aria-label={t('Open in canvas studio')}
                        title={t('Open in canvas studio')}
                        onClick={() =>
                          window.open(
                            studioUrl,
                            '_blank',
                            'noopener,noreferrer'
                          )
                        }
                      >
                        <Globe2 />
                      </Button>
                    )}

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
                      onClick={() => void handleDelete(doc)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
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
            <Button onClick={() => void submitRename()}>{t('Save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
