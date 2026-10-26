/**
 * 画廊审核后台（管理员，路径 /admin/prompt-gallery）
 * ------------------------------------------------------------------
 * 展示所有投稿（可按状态筛选），支持「通过发布 / 驳回」，补全 UGC 审核闭环。
 * 后端接口：/api/prompt-gallery/v1/admin/prompts（GET / POST :id/status）。
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, X } from 'lucide-react'

import { Main } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

import type { PromptGalleryStatus } from './types'
import {
  useAdminPromptGalleries,
  useAdminSetPromptGalleryStatus,
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

  const { data, isLoading } = useAdminPromptGalleries(
    filter === 'all' ? undefined : filter
  )
  const setStatus = useAdminSetPromptGalleryStatus()

  const items = data?.items ?? []

  return (
    <Main>
      <div className='container mx-auto max-w-5xl px-4 py-8'>
        <div className='mb-6 flex items-center justify-between'>
          <div>
            <h1 className='text-2xl font-bold tracking-tight'>
              {t('Gallery review')}
            </h1>
            <p className='mt-1 text-sm text-muted-foreground'>
              {t('Review and publish gallery submissions.')}
            </p>
          </div>
          <Select
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

        {isLoading ? (
          <div className='space-y-3'>
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className='h-24 rounded-xl' />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className='rounded-xl border border-dashed py-16 text-center text-muted-foreground'>
            {t('Nothing to review')}
          </div>
        ) : (
          <div className='space-y-3'>
            {items.map((item) => (
              <div
                key={item.id}
                className='flex items-start gap-4 rounded-xl border bg-card p-4'
              >
                <div className='h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-muted'>
                  {item.cover ? (
                    <img
                      src={item.cover}
                      alt={item.title}
                      loading='lazy'
                      className='h-full w-full object-cover'
                    />
                  ) : (
                    <div className='flex h-full items-center justify-center text-xs text-muted-foreground'>
                      {item.type}
                    </div>
                  )}
                </div>

                <div className='min-w-0 flex-1'>
                  <div className='mb-1 flex flex-wrap items-center gap-2'>
                    <span className='truncate text-sm font-medium'>
                      {item.title}
                    </span>
                    <Badge variant={STATUS_BADGE[item.status] ?? 'secondary'}>
                      {t(STATUS_LABEL[item.status] ?? item.status)}
                    </Badge>
                    {item.model && (
                      <span className='rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground'>
                        {item.model}
                      </span>
                    )}
                  </div>
                  <p className='mb-1 line-clamp-2 text-xs text-muted-foreground'>
                    {item.prompt}
                  </p>
                  <div className='text-[11px] text-muted-foreground'>
                    {item.author} · {item.category}
                    {item.tags ? ` · ${item.tags}` : ''}
                  </div>
                </div>

                <div className='flex shrink-0 flex-col gap-2'>
                  {item.status !== 'published' && (
                    <Button
                      size='sm'
                      onClick={() =>
                        setStatus.mutate({ id: item.id, status: 'published' })
                      }
                      disabled={setStatus.isPending}
                    >
                      <Check className='size-3.5' /> {t('Publish')}
                    </Button>
                  )}
                  {item.status !== 'rejected' && (
                    <Button
                      size='sm'
                      variant='outline'
                      className={cn(
                        'text-destructive hover:text-destructive'
                      )}
                      onClick={() =>
                        setStatus.mutate({ id: item.id, status: 'rejected' })
                      }
                      disabled={setStatus.isPending}
                    >
                      <X className='size-3.5' /> {t('Reject')}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Main>
  )
}

export default AdminPromptGalleryReview
