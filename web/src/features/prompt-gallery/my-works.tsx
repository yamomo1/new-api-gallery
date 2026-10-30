/**
 * 我的作品 + 投稿（登录态，路径 /my-works）
 * ------------------------------------------------------------------
 * 列表展示「我」发布的画廊条目（含草稿/被拒状态），支持新建/编辑/删除。
 * 后端接口：/api/prompt-gallery/v1/mine（GET/POST/PUT/DELETE）。
 */
import { useEffect, useState } from 'react'
import { useSearch } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { Pencil, Plus, Trash2 } from 'lucide-react'

import { Main } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ImageUpload } from '@/components/common/image-upload'
import { useResolvedImageUrl } from '@/lib/storage'

import type { PromptGallerySubmit } from './api'
import type { PromptGalleryItem } from './types'
import {
  useCreatePromptGallery,
  useDeletePromptGallery,
  useMyPromptGalleries,
  useUpdatePromptGallery,
} from './hooks/use-prompt-gallery'

const EMPTY_FORM: PromptGallerySubmit = {
  title: '',
  prompt: '',
  prompt_en: '',
  model: '',
  type: 'image',
  cover: '',
  media: '[]',
  category: '',
  tags: '',
}

const STATUS_LABEL: Record<string, string> = {
  published: 'Published',
  draft: 'Pending review',
  rejected: 'Rejected',
}

const STATUS_BADGE: Record<string, 'default' | 'secondary' | 'warning' | 'destructive'> = {
  published: 'default',
  draft: 'warning',
  rejected: 'destructive',
}

export function MyWorks() {
  const { t } = useTranslation()
  const { create: autoCreate } = useSearch({ from: '/_authenticated/my-works/' })
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<PromptGalleryItem | null>(null)
  const [form, setForm] = useState<PromptGallerySubmit>(EMPTY_FORM)

  const { data, isLoading } = useMyPromptGalleries({ limit: 100 })
  const createMutation = useCreatePromptGallery()
  const updateMutation = useUpdatePromptGallery()
  const deleteMutation = useDeletePromptGallery()

  const items = data?.items ?? []

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setOpen(true)
  }

  // 从画廊页「发布作品」跳转（?create=1）时自动打开投稿弹窗
  useEffect(() => {
    if (autoCreate) openCreate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoCreate])

  const openEdit = (item: PromptGalleryItem) => {
    setEditing(item)
    setForm({
      title: item.title,
      prompt: item.prompt,
      prompt_en: item.prompt_en ?? '',
      model: item.model,
      type: item.type,
      cover: item.cover,
      media: item.media,
      category: item.category,
      tags: item.tags,
    })
    setOpen(true)
  }

  const set = <K extends keyof PromptGallerySubmit>(
    key: K,
    value: PromptGallerySubmit[K]
  ) => setForm((f) => ({ ...f, [key]: value }))

  const handleSubmit = async () => {
    if (!form.title.trim() || !form.prompt.trim()) return
    if (editing) {
      await updateMutation.mutateAsync({ id: editing.id, payload: form })
    } else {
      await createMutation.mutateAsync(form)
    }
    setOpen(false)
  }

  const handleDelete = async (id: number) => {
    if (!window.confirm(t('Delete this work?'))) return
    await deleteMutation.mutateAsync(id)
  }

  return (
    <Main>
      <div className='container mx-auto max-w-5xl px-4 py-8'>
        <div className='mb-6 flex items-center justify-between'>
          <div>
            <h1 className='text-2xl font-bold tracking-tight'>
              {t('My works')}
            </h1>
            <p className='mt-1 text-sm text-muted-foreground'>
              {t('Manage the prompts you have submitted to the gallery.')}
            </p>
          </div>
          <Button onClick={openCreate}>
            <Plus className='size-4' /> {t('Submit work')}
          </Button>
        </div>

        {/* 列表 */}
        {isLoading ? (
          <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'>
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className='h-48 rounded-xl' />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className='rounded-xl border border-dashed py-16 text-center text-muted-foreground'>
            {t('No works yet')}
          </div>
        ) : (
          <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'>
            {items.map((item) => (
              <div
                key={item.id}
                className='group overflow-hidden rounded-xl border bg-card'
              >
                <div className='aspect-[4/3] overflow-hidden bg-muted'>
                  {item.cover ? (
                    <ResolvedCoverImage
                      src={item.cover}
                      alt={item.title}
                    />
                  ) : (
                    <div className='flex h-full items-center justify-center text-muted-foreground'>
                      {item.type === 'video' ? 'Video' : 'Image'}
                    </div>
                  )}
                </div>
                <div className='p-3'>
                  <div className='mb-1 flex items-center justify-between gap-2'>
                    <span className='truncate text-sm font-medium'>
                      {item.title}
                    </span>
                    <Badge variant={STATUS_BADGE[item.status] ?? 'secondary'}>
                      {t(STATUS_LABEL[item.status] ?? item.status)}
                    </Badge>
                  </div>
                  <p className='mb-2 line-clamp-2 text-xs text-muted-foreground'>
                    {item.prompt}
                  </p>
                  <div className='flex items-center gap-2'>
                    {item.model && (
                      <span className='rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground'>
                        {item.model}
                      </span>
                    )}
                    <div className='ml-auto flex gap-1'>
                      <Button
                        variant='ghost'
                        size='icon-sm'
                        onClick={() => openEdit(item)}
                        aria-label={t('Edit')}
                      >
                        <Pencil className='size-3.5' />
                      </Button>
                      <Button
                        variant='ghost'
                        size='icon-sm'
                        onClick={() => handleDelete(item.id)}
                        aria-label={t('Delete')}
                        className='text-destructive hover:text-destructive'
                      >
                        <Trash2 className='size-3.5' />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 投稿/编辑对话框 */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className='sm:max-w-lg'>
          <DialogHeader>
            <DialogTitle>
              {editing ? t('Edit work') : t('Submit work')}
            </DialogTitle>
            <DialogDescription>
              {t('Your work will be reviewed before it appears publicly.')}
            </DialogDescription>
          </DialogHeader>

          <div className='space-y-4 py-2'>
            <div className='space-y-1.5'>
              <Label htmlFor='title'>{t('Title')}</Label>
              <Input
                id='title'
                value={form.title}
                onChange={(e) => set('title', e.target.value)}
                placeholder={t('A short title')}
              />
            </div>

            <div className='space-y-1.5'>
              <Label htmlFor='prompt'>{t('Prompt')}</Label>
              <Textarea
                id='prompt'
                value={form.prompt}
                onChange={(e) => set('prompt', e.target.value)}
                placeholder={t('The prompt that produced this work')}
                rows={4}
              />
            </div>

            <div className='space-y-1.5'>
              <Label htmlFor='prompt-en'>
                {t('English prompt')}
                <span className='ml-1 text-xs font-normal text-muted-foreground'>
                  ({t('optional')})
                </span>
              </Label>
              <Textarea
                id='prompt-en'
                value={form.prompt_en ?? ''}
                onChange={(e) => set('prompt_en', e.target.value)}
                placeholder={t('English version of the prompt for bilingual display')}
                rows={3}
              />
            </div>

            <div className='grid grid-cols-2 gap-3'>
              <div className='space-y-1.5'>
                <Label htmlFor='model'>{t('Model')}</Label>
                <Input
                  id='model'
                  value={form.model}
                  onChange={(e) => set('model', e.target.value)}
                  placeholder='gpt-image-2.5'
                />
              </div>
              <div className='space-y-1.5'>
                <Label>{t('Type')}</Label>
                <Select
                  value={form.type}
                  onValueChange={(v) => set('type', v || 'image')}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='image'>{t('Image')}</SelectItem>
                    <SelectItem value='video'>{t('Video')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className='space-y-1.5'>
              <Label htmlFor='cover'>{t('Cover image')}</Label>
              <ImageUpload
                value={form.cover}
                onChange={(url) => set('cover', url)}
                placeholder={t('Upload a cover image')}
              />
            </div>

            <div className='grid grid-cols-2 gap-3'>
              <div className='space-y-1.5'>
                <Label htmlFor='category'>{t('Category')}</Label>
                <Input
                  id='category'
                  value={form.category}
                  onChange={(e) => set('category', e.target.value)}
                />
              </div>
              <div className='space-y-1.5'>
                <Label htmlFor='tags'>{t('Tags')}</Label>
                <Input
                  id='tags'
                  value={form.tags}
                  onChange={(e) => set('tags', e.target.value)}
                  placeholder='a, b, c'
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant='outline' onClick={() => setOpen(false)}>
              {t('Cancel')}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={
                !form.title.trim() ||
                !form.prompt.trim() ||
                createMutation.isPending ||
                updateMutation.isPending
              }
            >
              {createMutation.isPending || updateMutation.isPending
                ? t('Saving…')
                : t('Save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Main>
  )
}

export default MyWorks

/** 封面缩略图：value 可以是 key 或完整 URL，展示时按用户地域解析成国内外地址 */
function ResolvedCoverImage({ src, alt }: { src: string; alt: string }) {
  const url = useResolvedImageUrl(src)
  return (
    <img
      src={url}
      alt={alt}
      loading='lazy'
      className='h-full w-full object-cover'
    />
  )
}
