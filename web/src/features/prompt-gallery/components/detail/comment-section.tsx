import { useNavigate } from '@tanstack/react-router'
import {
  Loader2,
  MessageSquare,
  Reply,
  Send,
  ThumbsUp,
  Trash2,
} from 'lucide-react'
import { useMemo, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'

import {
  useCreateGalleryComment,
  useDeleteGalleryComment,
  useGalleryComments,
  useLikeGalleryComment,
} from '../../hooks/use-prompt-gallery'
import type { GalleryComment } from '../../types'

const MAX_COMMENT_LENGTH = 500
const COMMENT_LIKED_KEY = 'gallery-comments:liked'

function readLikedComments(): Set<number> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = window.localStorage.getItem(COMMENT_LIKED_KEY)
    const arr = raw ? (JSON.parse(raw) as unknown) : []
    if (!Array.isArray(arr)) return new Set()
    return new Set(arr.filter((v): v is number => typeof v === 'number'))
  } catch {
    return new Set()
  }
}

function writeLikedComments(ids: Set<number>) {
  try {
    window.localStorage.setItem(COMMENT_LIKED_KEY, JSON.stringify([...ids]))
  } catch {
    // localStorage 不可用时忽略，点赞本身仍然生效
  }
}

/** 评论时间：YYYY/MM/DD HH:mm（参考站就是完整时间，比「x 分钟前」更沉稳） */
function formatCommentTime(timestamp: number): string {
  if (!timestamp) return ''
  const date = new Date(timestamp * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(
    date.getDate()
  )} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/**
 * 评论区（详情页左栏 / 大图查看器右侧面板共用）
 * ---------------------------------------------------------------
 * 版式对齐参考站的「讨论」区：大号输入胶囊、40px 头像、32px 行距、
 * 右侧点赞/回复。留白优先，不靠边框和密集小字制造层次。
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

  const [sort, setSort] = useState<'latest' | 'popular'>('latest')
  const { data, isLoading } = useGalleryComments(galleryId, sort)
  const createMutation = useCreateGalleryComment(galleryId)
  const deleteMutation = useDeleteGalleryComment(galleryId)
  const likeMutation = useLikeGalleryComment(galleryId)

  const [content, setContent] = useState('')
  const [liked, setLiked] = useState<Set<number>>(() => readLikedComments())
  const [likesOverride, setLikesOverride] = useState<Record<number, number>>({})
  const inputRef = useRef<HTMLInputElement>(null)

  const total = data?.total ?? initialCount
  const comments = useMemo(() => data?.items ?? [], [data])
  const myInitial = (currentUser?.display_name || currentUser?.username || 'U')
    .trim()
    .slice(0, 1)
    .toUpperCase()

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
      onError: (error) =>
        toast.error((error as Error).message || t('Failed to comment')),
    })
  }

  const remove = (comment: GalleryComment) => {
    if (
      !window.confirm(
        t('Delete this comment?', { defaultValue: '删除这条评论？' })
      )
    ) {
      return
    }
    deleteMutation.mutate(comment.id)
  }

  const like = (comment: GalleryComment) => {
    if (liked.has(comment.id)) return
    const next = new Set(liked)
    next.add(comment.id)
    setLiked(next)
    writeLikedComments(next)
    likeMutation.mutate(comment.id, {
      onSuccess: (result) => {
        setLikesOverride((prev) => ({ ...prev, [comment.id]: result.likes }))
      },
    })
  }

  const reply = (comment: GalleryComment) => {
    if (!isLoggedIn) {
      goSignIn()
      return
    }
    setContent(`@${comment.username} `)
    inputRef.current?.focus()
  }

  const tabs: { key: 'popular' | 'latest'; label: string }[] = [
    { key: 'popular', label: t('Hottest', { defaultValue: '最热' }) },
    { key: 'latest', label: t('Latest', { defaultValue: '最新' }) },
  ]

  let listBody: ReactNode
  if (isLoading) {
    listBody = (
      <div className='flex items-center justify-center py-10 text-muted-foreground/60'>
        <Loader2 className='size-5 animate-spin' />
      </div>
    )
  } else if (comments.length === 0) {
    listBody = (
      <div className='flex flex-col items-center gap-3 py-10 text-center'>
        <MessageSquare className='size-9 text-muted-foreground/20' />
        <p className='text-[13.5px] text-muted-foreground/70'>
          {t('No comments yet', { defaultValue: '暂无评论' })}
        </p>
      </div>
    )
  } else {
    listBody = (
      <>
        <ul className={cn('mt-8', compact ? 'space-y-5' : 'space-y-8')}>
          {comments.map((comment) => {
            const canDelete =
              comment.is_mine || (currentUser?.id ?? 0) === comment.user_id
            const likeCount = likesOverride[comment.id] ?? comment.likes

            const nameRow = (
              <div className='flex flex-wrap items-center gap-x-2 gap-y-1'>
                <span className='text-[14px] text-muted-foreground'>
                  {comment.username ||
                    t('Anonymous', { defaultValue: '匿名创作者' })}
                </span>
                {comment.badge && (
                  <span className='rounded bg-[#1F6DFF]/10 px-1.5 py-[2px] text-[11px] text-[#1F6DFF]'>
                    {comment.badge}
                  </span>
                )}
              </div>
            )

            const textBlock = (
              <p
                className={cn(
                  'mt-2 break-words whitespace-pre-wrap text-foreground/90',
                  compact
                    ? 'text-[13px] leading-[1.75]'
                    : 'text-[14.5px] leading-[1.8]'
                )}
              >
                {comment.content}
              </p>
            )

            const timeBlock = (
              <span className='text-[12.5px] text-muted-foreground/60'>
                {formatCommentTime(comment.created_at)}
              </span>
            )

            // 点赞 / 回复 / 删除
            const actions = (
              <div className='flex shrink-0 items-center gap-4 text-[13px] text-muted-foreground/70'>
                <button
                  type='button'
                  onClick={() => like(comment)}
                  disabled={liked.has(comment.id)}
                  className={cn(
                    'inline-flex items-center gap-1.5 transition-colors',
                    liked.has(comment.id)
                      ? 'text-primary'
                      : 'hover:text-foreground'
                  )}
                >
                  <ThumbsUp className='size-4' />
                  {likeCount}
                </button>
                <button
                  type='button'
                  onClick={() => reply(comment)}
                  className='inline-flex items-center gap-1.5 transition-colors hover:text-foreground'
                >
                  <Reply className='size-4' />
                  {t('Reply', { defaultValue: '回复' })}
                </button>
                {canDelete && (
                  <button
                    type='button'
                    onClick={() => remove(comment)}
                    disabled={deleteMutation.isPending}
                    aria-label={t('Delete', { defaultValue: '删除' })}
                    className='inline-flex items-center text-muted-foreground/50 transition-colors hover:text-destructive disabled:opacity-50'
                  >
                    <Trash2 className='size-4' />
                  </button>
                )}
              </div>
            )

            return (
              <li key={comment.id} className='flex gap-4'>
                <span
                  className={cn(
                    'flex shrink-0 items-center justify-center rounded-full bg-muted font-medium text-foreground/70',
                    compact ? 'size-8 text-[13px]' : 'size-10 text-[15px]'
                  )}
                >
                  {(comment.username || '?').trim().slice(0, 1).toUpperCase()}
                </span>

                <div className='min-w-0 flex-1'>
                  {compact ? (
                    // 窄面板：操作放到时间同一行，正文才不会被挤成一条缝
                    <>
                      {nameRow}
                      {textBlock}
                      <div className='mt-3 flex items-center justify-between gap-3'>
                        {timeBlock}
                        {actions}
                      </div>
                    </>
                  ) : (
                    <div className='flex items-start justify-between gap-6'>
                      <div className='min-w-0 flex-1'>
                        {nameRow}
                        {textBlock}
                        <div className='mt-3'>{timeBlock}</div>
                      </div>
                      <div className='pt-0.5'>{actions}</div>
                    </div>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
        <p className='mt-10 text-center text-[13px] text-muted-foreground/60'>
          {t('No more comments', { defaultValue: '暂时没有更多评论' })}
        </p>
      </>
    )
  }

  return (
    <section>
      <h2
        className={cn(
          'font-semibold text-foreground',
          compact ? 'text-[15px]' : 'text-[18px]'
        )}
      >
        {t('Discussion', { defaultValue: '讨论' })}
        {total > 0 && (
          <span className='ml-2 text-[14px] font-normal text-muted-foreground'>
            ({total})
          </span>
        )}
      </h2>

      {/* 排序：最热按点赞、最新按时间，都是真排序 */}
      <div className='mt-3 flex items-center gap-3 text-[13px]'>
        {tabs.map((tab, i) => (
          <span key={tab.key} className='flex items-center gap-3'>
            {i > 0 && <span className='text-border'>|</span>}
            <button
              type='button'
              onClick={() => setSort(tab.key)}
              className={cn(
                'transition-colors',
                sort === tab.key
                  ? 'font-medium text-foreground'
                  : 'text-muted-foreground hover:text-foreground/80'
              )}
            >
              {tab.label}
            </button>
          </span>
        ))}
      </div>

      {/* 输入区：大号胶囊、不加边框，靠底色分层；未登录点它直接去登录 */}
      <div
        className={cn('flex items-center gap-3', compact ? 'mt-4' : 'mt-5')}
      >
        <span
          className={cn(
            'flex shrink-0 items-center justify-center rounded-full font-medium',
            compact ? 'size-8 text-[13px]' : 'size-11 text-[15px]',
            isLoggedIn
              ? 'bg-muted text-foreground/70'
              : 'bg-[#FFE8BF] text-[17px]'
          )}
        >
          {isLoggedIn ? myInitial : '🙂'}
        </span>

        <div className='relative min-w-0 flex-1'>
          <input
            ref={inputRef}
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
                ? t('Say something kind', {
                    defaultValue: '善语结善缘，恶言伤人心～',
                  })
                : t('Sign in to comment', { defaultValue: '登录后参与评论' })
            }
            className={cn(
              'w-full rounded-full bg-[#F4F5F9] pr-24 pl-5 text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus:bg-[#EEF0F5]',
              compact ? 'h-10 text-[13px]' : 'h-[52px] text-[14px]'
            )}
          />
          {isLoggedIn && content.trim() && (
            <button
              type='button'
              onClick={submit}
              disabled={createMutation.isPending}
              className={cn(
                'absolute top-1/2 right-1.5 inline-flex -translate-y-1/2 items-center gap-1.5 rounded-full bg-[#FED578] font-medium text-[#8A4200] transition-opacity hover:opacity-90 disabled:opacity-60',
                compact ? 'h-7 px-2.5 text-[12px]' : 'h-9 px-4 text-[13px]'
              )}
            >
              {createMutation.isPending ? (
                <Loader2 className='size-4 animate-spin' />
              ) : (
                <Send className='size-4' />
              )}
              {t('Send', { defaultValue: '发送' })}
            </button>
          )}
        </div>
      </div>

      {listBody}
    </section>
  )
}
