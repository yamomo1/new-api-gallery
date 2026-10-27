/**
 * 画廊审核后台（管理员，路径 /admin/prompt-gallery）
 * ------------------------------------------------------------------
 * 列表形式展示所有投稿（可按状态筛选），每条后面四个动作：
 * - 首页显示：勾选后该作品在公开列表置顶，会优先出现在首页 03 画廊
 * - 审核：通过发布 / 驳回 / 退回待审
 * - 编辑：改标题、提示词、模型、类型、封面、媒体、分类、标签
 * - 删除：二次确认后删除
 *
 * 后端接口：/api/prompt-gallery/v1/admin/prompts
 *   GET / POST :id/status / POST :id/home / PUT :id / DELETE :id
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Check,
  ChevronDown,
  Home,
  Pencil,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react'

import { Main } from '@/components/layout'
import { Dialog } from '@/components/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

import type { PromptGalleryItem, PromptGalleryStatus } from './types'
import {
  useAdminDeletePromptGallery,
  useAdminPromptGalleries,
  useAdminSetPromptGalleryHome,
  useAdminSetPromptGalleryStatus,
  useAdminUpdatePromptGallery,
} from './hooks/use-prompt-gallery'

const STATUS_LABEL: Record<string, string> = {
  published: 'Published',
  draft: 'Pending review',
  rejected: 'Rejected',
}

const STATUS_BADGE: Record<
  string,
  'default' | 'secondary' | 'warning' | 'destructive'
> = {
  published: 'default',
  draft: 'warning',
  rejected: 'destructive',
}

export function AdminPromptGalleryReview() {
  const { t } = useTranslation()
  const [filter, setFilter] = useState<PromptGalleryStatus | 'all'>('draft')
  const [editing, setEditing] = useState<PromptGalleryItem | null>(null)

  const { data, isLoading } = useAdminPromptGalleries(
    filter === 'all' ? undefined : filter
  )
  const setStatus = useAdminSetPromptGalleryStatus()
  const setHome = useAdminSetPromptGalleryHome()
  const update = useAdminUpdatePromptGallery()
  const remove = useAdminDeletePromptGallery()

  const items = data?.items ?? []
  const total = data?.total ?? items.length

  const saveEdit = () => {
    if (!editing) return
    update.mutate(
      {
        id: editing.id,
        payload: {
          title: editing.title,
          prompt: editing.prompt,
          model: editing.model,
          type: editing.type,
          cover: editing.cover,
          media: editing.media,
          category: editing.category,
          tags: editing.tags,
        },
      },
      { onSuccess: () => setEditing(null) }
    )
  }

  return (
    <Main>
      <div className='container mx-auto max-w-7xl px-4 py-8'>
        <div className='mb-6 flex flex-wrap items-end justify-between gap-3'>
          <div>
            <h1 className='text-2xl font-bold tracking-tight'>
              {t('Gallery review')}
            </h1>
            <p className='mt-1 text-sm text-muted-foreground'>
              {t('Review and publish gallery submissions.')}
            </p>
          </div>
          <div className='flex items-center gap-2'>
            <Badge variant='outline' className='tabular-nums'>
              {total} {t('Works')}
            </Badge>
            <Select
              items={[
                { value: 'draft', label: t('Pending review') },
                { value: 'published', label: t('Published') },
                { value: 'rejected', label: t('Rejected') },
                { value: 'all', label: t('All') },
              ]}
              value={filter}
              onValueChange={(v) =>
                setFilter((v as PromptGalleryStatus | 'all') || 'all')
              }
            >
              <SelectTrigger className='w-44'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='draft'>{t('Pending review')}</SelectItem>
                <SelectItem value='published'>{t('Published')}</SelectItem>
                <SelectItem value='rejected'>{t('Rejected')}</SelectItem>
                <SelectItem value='all'>{t('All')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <div className='space-y-2'>
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className='h-16 rounded-lg' />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className='rounded-xl border border-dashed py-16 text-center text-muted-foreground'>
            {t('Nothing to review')}
          </div>
        ) : (
          <div className='overflow-hidden rounded-xl border bg-card'>
            <div className='overflow-x-auto'>
              <Table className='min-w-[940px]'>
                <TableHeader>
                  <TableRow>
                    <TableHead className='min-w-[300px]'>{t('Work')}</TableHead>
                    <TableHead className='w-24'>{t('Type')}</TableHead>
                    <TableHead className='w-28'>{t('Status')}</TableHead>
                    <TableHead className='w-28'>{t('Stats')}</TableHead>
                    <TableHead className='w-[330px] text-right'>
                      {t('Actions')}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => {
                    const homeOn = !!item.home
                    // 只有已发布的作品能上首页；草稿/驳回先审核
                    const canShowHome = item.status === 'published'
                    return (
                      <TableRow key={item.id}>
                        {/* 作品：缩略图 + 标题 + 提示词摘要 + 模型/分类/作者 */}
                        <TableCell>
                          <div className='flex items-center gap-3'>
                            <div className='h-12 w-12 shrink-0 overflow-hidden rounded-md bg-muted'>
                              {item.cover ? (
                                <img
                                  src={item.cover}
                                  alt={item.title}
                                  loading='lazy'
                                  className='h-full w-full object-cover'
                                />
                              ) : (
                                <div className='flex h-full items-center justify-center text-[10px] text-muted-foreground'>
                                  {item.type}
                                </div>
                              )}
                            </div>
                            <div className='min-w-0'>
                              <div className='flex items-center gap-1.5'>
                                <span className='truncate text-sm font-medium'>
                                  {item.title}
                                </span>
                                {homeOn && (
                                  <Badge
                                    variant='outline'
                                    className='shrink-0 gap-1 border-amber-500/50 text-[10px] text-amber-600 dark:text-amber-400'
                                  >
                                    <Home className='size-2.5' />
                                    {t('On homepage')}
                                  </Badge>
                                )}
                              </div>
                              <p className='mt-0.5 line-clamp-1 text-xs text-muted-foreground'>
                                {item.prompt}
                              </p>
                              <p className='mt-0.5 truncate text-[11px] text-muted-foreground/80'>
                                {[item.model, item.category, item.author]
                                  .filter(Boolean)
                                  .join(' · ')}
                              </p>
                            </div>
                          </div>
                        </TableCell>

                        <TableCell>
                          <Badge variant='secondary'>
                            {item.type === 'video' ? t('Video') : t('Image')}
                          </Badge>
                        </TableCell>

                        <TableCell>
                          <Badge
                            variant={STATUS_BADGE[item.status] ?? 'secondary'}
                          >
                            {t(STATUS_LABEL[item.status] ?? item.status)}
                          </Badge>
                        </TableCell>

                        <TableCell>
                          <div className='text-xs tabular-nums text-muted-foreground'>
                            <div>
                              {item.views} {t('Views')}
                            </div>
                            <div>
                              {item.likes} {t('Likes')}
                            </div>
                          </div>
                        </TableCell>

                        {/* 每条后面四个动作：首页显示 / 审核 / 编辑 / 删除 */}
                        <TableCell>
                          <div className='flex items-center justify-end gap-1.5'>
                            <Button
                              size='sm'
                              variant={homeOn ? 'default' : 'outline'}
                              className={cn(
                                'h-8 gap-1 px-2 text-xs',
                                homeOn &&
                                  'bg-amber-500 text-amber-950 hover:bg-amber-500/90'
                              )}
                              onClick={() =>
                                setHome.mutate({ id: item.id, home: !homeOn })
                              }
                              disabled={setHome.isPending || !canShowHome}
                              title={
                                canShowHome
                                  ? t('Show on homepage')
                                  : t('Publish it first to show it on the homepage.')
                              }
                            >
                              <Home className='size-3.5' />
                              {homeOn ? t('On homepage') : t('Show on homepage')}
                            </Button>

                            <DropdownMenu>
                              <DropdownMenuTrigger
                                render={
                                  <Button
                                    size='sm'
                                    variant='outline'
                                    className='h-8 gap-1 px-2 text-xs'
                                    disabled={setStatus.isPending}
                                  >
                                    {t('Review')}
                                    <ChevronDown className='size-3' />
                                  </Button>
                                }
                              />
                              <DropdownMenuContent align='end'>
                                <DropdownMenuItem
                                  onClick={() =>
                                    setStatus.mutate({
                                      id: item.id,
                                      status: 'published',
                                    })
                                  }
                                >
                                  <Check className='size-3.5' />
                                  {t('Publish')}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() =>
                                    setStatus.mutate({
                                      id: item.id,
                                      status: 'rejected',
                                    })
                                  }
                                >
                                  <X className='size-3.5' />
                                  {t('Reject')}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() =>
                                    setStatus.mutate({
                                      id: item.id,
                                      status: 'draft',
                                    })
                                  }
                                >
                                  <RotateCcw className='size-3.5' />
                                  {t('Move back to review')}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>

                            <Button
                              size='sm'
                              variant='outline'
                              className='h-8 gap-1 px-2 text-xs'
                              onClick={() => setEditing(item)}
                            >
                              <Pencil className='size-3.5' />
                              {t('Edit')}
                            </Button>

                            <AlertDialog>
                              <AlertDialogTrigger
                                render={
                                  <Button
                                    size='sm'
                                    variant='outline'
                                    className='h-8 gap-1 px-2 text-xs text-destructive hover:text-destructive'
                                  >
                                    <Trash2 className='size-3.5' />
                                    {t('Delete')}
                                  </Button>
                                }
                              />
                              <AlertDialogContent size='default'>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>
                                    {t('Delete this work?')}
                                  </AlertDialogTitle>
                                  <AlertDialogDescription>
                                    {t('This cannot be undone.')}
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>
                                    {t('Cancel')}
                                  </AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => remove.mutate(item.id)}
                                  >
                                    {t('Delete')}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* 编辑作品 */}
        <Dialog
          open={!!editing}
          onOpenChange={(open: boolean) => {
            if (!open) setEditing(null)
          }}
          title={t('Edit work')}
          description={t('Changes go live immediately; the review status stays the same.')}
          contentHeight='62vh'
          footer={
            <div className='flex justify-end gap-2'>
              <Button variant='outline' onClick={() => setEditing(null)}>
                {t('Cancel')}
              </Button>
              <Button onClick={saveEdit} disabled={update.isPending}>
                {t('Save')}
              </Button>
            </div>
          }
        >
          {editing && (
            <div className='grid gap-3'>
              <div className='space-y-1.5'>
                <Label>{t('Title')}</Label>
                <Input
                  value={editing.title}
                  onChange={(e) =>
                    setEditing({ ...editing, title: e.target.value })
                  }
                />
              </div>
              <div className='space-y-1.5'>
                <Label>{t('Prompt')}</Label>
                <Textarea
                  rows={5}
                  value={editing.prompt}
                  onChange={(e) =>
                    setEditing({ ...editing, prompt: e.target.value })
                  }
                />
              </div>
              <div className='grid gap-3 sm:grid-cols-3'>
                <div className='space-y-1.5'>
                  <Label>{t('Model')}</Label>
                  <Input
                    value={editing.model}
                    onChange={(e) =>
                      setEditing({ ...editing, model: e.target.value })
                    }
                  />
                </div>
                <div className='space-y-1.5'>
                  <Label>{t('Type')}</Label>
                  <Select
                    items={[
                      { value: 'image', label: t('Image') },
                      { value: 'video', label: t('Video') },
                    ]}
                    value={editing.type}
                    onValueChange={(v) =>
                      setEditing({
                        ...editing,
                        type: v === 'video' ? 'video' : 'image',
                      })
                    }
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
                <div className='space-y-1.5'>
                  <Label>{t('Category')}</Label>
                  <Input
                    value={editing.category}
                    onChange={(e) =>
                      setEditing({ ...editing, category: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className='grid gap-3 sm:grid-cols-2'>
                <div className='space-y-1.5'>
                  <Label>{t('Cover')}</Label>
                  <Input
                    value={editing.cover}
                    onChange={(e) =>
                      setEditing({ ...editing, cover: e.target.value })
                    }
                  />
                </div>
                <div className='space-y-1.5'>
                  <Label>{t('Tags')}</Label>
                  <Input
                    value={editing.tags}
                    onChange={(e) =>
                      setEditing({ ...editing, tags: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className='space-y-1.5'>
                <Label>{t('Media (JSON array)')}</Label>
                <Textarea
                  rows={3}
                  value={editing.media}
                  onChange={(e) =>
                    setEditing({ ...editing, media: e.target.value })
                  }
                />
              </div>
            </div>
          )}
        </Dialog>
      </div>
    </Main>
  )
}

export default AdminPromptGalleryReview
