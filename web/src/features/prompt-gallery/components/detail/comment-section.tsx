import { useNavigate } from '@tanstack/react-router'
import { Loader2, MessageSquare, Send, Trash2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'

import {
  useCreateGalleryComment,
  useDeleteGalleryComment,
  useGalleryComments,
} from '../../hooks/use-prompt-gallery'
import type { GalleryComment } from '../../types'
import { formatPublishDate } from '../../utils'

const MAX_COMMENT_LENGTH = 500

/**
 * 评论区（详情页左栏 / 大图查看器右侧面板共用）
 * ---------------------------------------------------------------
 * - 列表公开可读，未登录也能看；发评论要登录，未登录点输入框直接跳登录并带回当前页。
 * - 只做平铺、最新在前；自己的评论（或管理员）显示删除。
 * - `compact` 用于 380px 的查看器侧栏：字号与间距收一档。
 */
export function CommentSection({
  galleryId,
  initialCount = 0,
  compact = false,
}: {
  galleryId: number
  /** 详情接口带回来的评论数，避免首屏先显示 0 再跳到真实值 */
  initialCount?: number
  compact?: boolean
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const isLoggedIn = useAuthStore((state) => Boolean(state.auth.user))
  const currentUser = useAuthStore((state) => state.auth.user)

  const { data, isLoading } = useGalleryComments(galleryId)
  const createMutation = useCreateGalleryComment(galleryId)
  const deleteMutation = useDeleteGalleryComment(galleryId)
  const [content, setContent] = useState('')

  const total = data?.total ?? initialCount
  const comments = data?.items ?? []
  const myInitial = (currentUser?.display_name || currentUser?.username || 'U')
    .trim()
    .slice(0, 1)
    .toUpperCase()

  // 相对时间：一周内用「x 分钟/小时/天前」，更早直接给日期
  const relativeTime = (timestamp: number) => {
    if (!timestamp) return ''
    const diff = Math.floor(Date.now() / 1000) - timestamp
    if (diff < 60) return t('just now', { defaultValue: '刚刚' })
    if (diff < 3600) {
      const minutes = Math.floor(diff / 60)
      return t('{{count}} min ago', {
        count: minutes,
        defaultValue: `${minutes} 分钟前`,
      })
    }
    if (diff < 86400) {
      const hours = Math.floor(diff / 3600)
      return t('{{count}} h ago', {
        count: hours,
        defaultValue: `${hours} 小时前`,
      })
    }
    if (diff < 86400 * 7) {
      const days = Math.floor(diff / 86400)
      return t('{{count}} d ago', {
        count: days,
        defaultValue: `${days} 天前`,
      })
    }
    return formatPublishDate(timestamp)
  }

  const goSignIn = () => {
    void navigate({ to: '/sign-in', search: { redirect: window.location.href } })
  }

  const submit = () => {
    if (!isLoggedIn) {
      goSignIn()
      return
    }
    const text = content.trim()
    if (!text) return
    createMutation.mutate(text, {
      onSuccess: () => setContent(''),
      onError: (error) => toast.error((error as Error).message || t('Failed to comment')),
    })
  }

  const remove = (comment: GalleryComment) => {
    if (!window.confirm(t('Delete this comment?', { defaultValue: '删除这条评论？' }))) {
      return
    }
    deleteMutation.mutate(comment.id)
  }

  const titleClass = compact ? 'text-[13px]' : 'text-[14px]'

  let commentBody: ReactNode
  if (isLoading) {
    commentBody = (
        <div className='mt-4 flex items-center justify-center py-4 text-muted-foreground/60'>
          <Loader2 className='size-4 animate-spin' />
        </div>
    )
  } else if (comments.length === 0) {
    commentBody = (

        <div className='mt-4 flex flex-col items-center gap-1.5 text-center'>
          <MessageSquare className='size-7 text-muted-foreground/25' />
          <p className='text-[12px] text-muted-foreground/70'>
            {t('No comments yet', { defaultValue: '暂无评论' })}
          </p>
        </div>
    )
  } else {
    commentBody = (
        <ul className={cn('mt-3 space-y-3.5', compact && 'mt-2.5 space-y-3')}>
          {comments.map((comment) => (
            <li key={comment.id} className='flex items-start gap-2.5'>
              <span
                className={cn(
                  'flex shrink-0 items-center justify-center rounded-full bg-muted font-medium text-foreground/70',
                  compact ? 'size-7 text-[11px]' : 'size-8 text-[12px]'
                )}
              >
                {(comment.username || '?').trim().slice(0, 1).toUpperCase()}
              </span>
              <div className='min-w-0 flex-1'>
                <div className='flex flex-wrap items-center gap-x-2 gap-y-0.5'>
                  <span className='text-[12.5px] font-medium text-foreground'>
                    {comment.username || t('Anonymous', { defaultValue: '匿名创作者' })}
                  </span>
                  {comment.badge && (
                    <span className='rounded bg-[#1F6DFF]/10 px-1 py-[1px] text-[10px] text-[#1F6DFF]'>
                      {comment.badge}
                    </span>
                  )}
                  <span className='text-[11px] text-muted-foreground/70'>
                    {relativeTime(comment.created_at)}
                  </span>
                  {(comment.is_mine ||
                    (currentUser?.id ?? 0) === comment.user_id) && (
                    <button
                      type='button'
                      onClick={() => remove(comment)}
                      disabled={deleteMutation.isPending}
                      aria-label={t('Delete', { defaultValue: '删除' })}
                      className='inline-flex items-center gap-0.5 text-[11px] text-muted-foreground/60 transition-colors hover:text-destructive disabled:opacity-50'
                    >
                      <Trash2 className='size-3' />
                      {t('Delete', { defaultValue: '删除' })}
                    </button>
                  )}
                </div>
                <p className='mt-0.5 text-[12.5px] leading-relaxed break-words whitespace-pre-wrap text-foreground/85'>
                  {comment.content}
                </p>
              </div>
            </li>
          ))}
        </ul>
    )
  }

  return (
    <section>
      <h2 className={cn('font-medium text-foreground', titleClass)}>
        {t('Comments', { defaultValue: '评论' })}
        {total > 0 && (
          <span className='ml-1 text-[12px] font-normal text-muted-foreground'>
            ({total})
          </span>
        )}
      </h2>

      {/* 输入区：未登录时点它就跳登录，不做「能打字但发不出去」的假输入框 */}
      <div className={cn('mt-2.5 flex items-center gap-2', compact && 'mt-2')}>
        <span
          className={cn(
            'flex shrink-0 items-center justify-center rounded-full bg-muted font-medium text-muted-foreground',
            compact ? 'size-7 text-[11px]' : 'size-8 text-[12px]'
          )}
        >
          {isLoggedIn ? myInitial : <MessageSquare className='size-3.5' />}
        </span>
        <div className='relative min-w-0 flex-1'>
          <input
            value={content}
            maxLength={MAX_COMMENT_LENGTH}
            onChange={(event) => setContent(event.target.value)}
            onFocus={() => {
              if (!isLoggedIn) goSignIn()
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                submit()
              }
            }}
            aria-label={t('Comments', { defaultValue: '评论' })}
            placeholder={
              isLoggedIn
                ? t('Say something about this work', { defaultValue: '说点什么…' })
                : t('Sign in to comment', { defaultValue: '登录后参与评论' })
            }
            className={cn(
              'h-9 w-full rounded-full border border-border/60 bg-muted/40 pr-16 pl-3.5 text-[12.5px] text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary/40 focus:bg-background',
              compact && 'h-8 text-[12px]'
            )}
          />
          {isLoggedIn && content.trim() && (
            <button
              type='button'
              onClick={submit}
              disabled={createMutation.isPending}
              className='absolute top-1/2 right-1 inline-flex h-7 -translate-y-1/2 items-center gap-1 rounded-full bg-[#FED578] px-2.5 text-[12px] font-medium text-[#8A4200] transition-opacity hover:opacity-90 disabled:opacity-60'
            >
              {createMutation.isPending ? (
                <Loader2 className='size-3.5 animate-spin' />
              ) : (
                <Send className='size-3.5' />
              )}
              {t('Send', { defaultValue: '发送' })}
            </button>
          )}
        </div>
      </div>

      {commentBody}
    </section>
  )
}
