import { useTranslation } from 'react-i18next'
import { ChevronDown, ExternalLink, Eye, Heart, Sparkles } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { runningHubInviteUrl } from '@/features/canvas/runninghub'
import { cn } from '@/lib/utils'

import { CreateWithThis } from '../create-with-this'
import type { PromptGalleryItem } from '../types'
import { formatPublishDate, parseGalleryMedia, parseGalleryTags } from '../utils'
import { RecommendStrip } from './recommend-strip'
import { AuthorCard } from './detail/author-card'
import { MediaGallery } from './detail/media-gallery'
import { MediaLightbox } from './detail/media-lightbox'
import {
  DetailDisclaimer,
  KeyValueRow,
  MetaChip,
  MetaSection,
  PrimaryActions,
} from './detail/detail-parts'

type GalleryDetailBodyProps = {
  item: PromptGalleryItem
  liked?: boolean
  likeCount?: number
  onLike?: (item: PromptGalleryItem) => void
  favorited?: boolean
  onToggleFavorite?: (id: number) => void
  onShare?: (item: PromptGalleryItem) => void
  onTagSelect?: (tag: string) => void
  onSelectRecommend?: (id: number) => void
  /** page：常规页面（右栏 sticky 到顶栏下方）；dialog：全屏弹窗内滚动 */
  variant?: 'page' | 'dialog'
}

/**
 * 作品详情主体：左栏内容 + 右栏信息卡。
 *
 * 布局参考 liblib 模型详情页——标题与媒体在左，右栏是一条 300px 的窄信息栏
 * （作者 → 操作 → 版本详情 → 使用参数 → 使用说明）。
 * 详情页与列表页弹窗共用本组件，避免两套 UI 漂移。
 */
export function GalleryDetailBody({
  item,
  liked,
  likeCount,
  onLike,
  favorited,
  onToggleFavorite,
  onShare,
  onTagSelect,
  onSelectRecommend,
  variant = 'page',
}: GalleryDetailBodyProps) {
  const { t } = useTranslation()
  // 大图查看器当前图片下标；null = 关闭
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)

  const media = useMemo(() => parseGalleryMedia(item), [item])
  const tags = useMemo(() => parseGalleryTags(item.tags), [item])

  useEffect(() => {
    setViewerIndex(null)
  }, [item.id])

  const typeLabel =
    item.type === 'video'
      ? t('Video prompt', { defaultValue: '视频提示词' })
      : t('Image prompt', { defaultValue: '图片提示词' })

  const scrollToCreate = () => {
    document
      .querySelector('#gallery-create-with-this')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className='grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-7'>
      {/* ── 左栏：标题 → 媒体 → 提示词 → 去创作 → 推荐 ── */}
      <div className='min-w-0 space-y-6'>
        <header>
          <h1 className='text-[26px] leading-tight font-semibold tracking-tight md:text-[32px]'>
            {item.title}
          </h1>
          {/* 标签行：模型/类型/分类/标签 靠左，浏览点赞靠右（对齐参考稿） */}
          <div className='mt-3.5 flex flex-wrap items-center gap-2'>
            {item.model && (
              <MetaChip tone='primary'>
                <Sparkles className='mr-1 size-3' />
                {item.model}
              </MetaChip>
            )}
            <MetaChip>{typeLabel}</MetaChip>
            {item.category && <MetaChip>{item.category}</MetaChip>}
            {tags.map((tag) => (
              <button
                key={tag}
                type='button'
                onClick={() => onTagSelect?.(tag)}
                className='rounded-lg bg-muted px-2.5 py-1 text-[12.5px] leading-none text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground'
              >
                #{tag}
              </button>
            ))}
            <div className='ml-auto flex items-center gap-3.5 text-[12.5px] text-muted-foreground'>
              <span className='inline-flex items-center gap-1'>
                <Eye className='size-3.5' />
                {item.views}
              </span>
              <span className='inline-flex items-center gap-1'>
                <Heart className='size-3.5' />
                {likeCount ?? item.likes}
              </span>
            </div>
          </div>
        </header>

        {/* 移动端把作者与操作提到标题下方，避免用户滚到底部才能收藏 */}
        <div className='space-y-3 lg:hidden'>
          <AuthorCard
            authorId={item.author_id}
            author={item.author}
            badge={item.author_badge}
          />
          <PrimaryActions
            favorited={Boolean(favorited)}
            onToggleFavorite={() => onToggleFavorite?.(item.id)}
            onCreate={scrollToCreate}
          />
        </div>

        {/* 媒体：并排双图 + 左右切换；每张图右下角「生成信息」浮层，点图看大图 */}
        <MediaGallery
          item={item}
          media={media}
          onOpenViewer={setViewerIndex}
          onScrollToCreate={scrollToCreate}
        />

        <section>
          <h2 className='mb-2.5 text-[15px] font-semibold text-foreground'>
            {t('How to use this prompt', { defaultValue: '使用教学' })}
          </h2>
          <div className='rounded-xl border border-border/60 bg-card px-4 py-3.5'>
            <ol className='space-y-1.5 text-[12.5px] leading-relaxed text-muted-foreground'>
              <li>
                1.{' '}
                {t('Copy the prompt from the image panel', {
                  defaultValue: '点图片右下的「生成信息」，复制提示词',
                })}
              </li>
              <li>
                2.{' '}
                {t('Pick the same model in ComfyUI or RunningHub', {
                  defaultValue: '在 ComfyUI 或 RunningHub 里选择同一模型',
                })}
              </li>
              <li>
                3.{' '}
                {t('Paste it and generate, then tweak the parameters', {
                  defaultValue: '粘贴提示词并生成，再按需微调参数',
                })}
              </li>
            </ol>
            {/* 外链走 runningHubInviteUrl 单一真源，始终带推广码；勿手拼 URL */}
            <div className='mt-3 flex justify-end'>
              <a
                href={runningHubInviteUrl()}
                target='_blank'
                rel='noopener noreferrer'
                title={t('Opens RunningHub in a new tab with your invite code')}
                className='inline-flex items-center gap-1 text-[12px] font-medium text-primary transition-colors hover:text-primary/80'
              >
                <ExternalLink className='size-3.5' />
                {t('Try on RunningHub')}
              </a>
            </div>
          </div>
        </section>

        {/* 提示词正文：默认折叠但一直在 DOM 里 —— 详情页是长尾搜索入口，
            不能让提示词只存在于「点了才挂载」的浮层里，否则爬虫读不到正文 */}
        <details className='group rounded-xl border border-border/60 bg-card'>
          <summary className='flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-[13px] font-medium text-foreground'>
            {t('Full prompt', { defaultValue: '提示词全文' })}
            <ChevronDown className='size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180' />
          </summary>
          <div className='max-h-[280px] overflow-y-auto border-t border-border/50 px-4 py-3 text-[13px] leading-relaxed whitespace-pre-wrap text-foreground/85 [scrollbar-width:thin]'>
            {item.prompt}
            {item.prompt_en?.trim() && (
              <>
                <span className='mt-3 block h-px bg-border/50' />
                <span className='mt-3 block text-foreground/70'>
                  {item.prompt_en}
                </span>
              </>
            )}
          </div>
        </details>

        <div id='gallery-create-with-this' className='scroll-mt-24'>
          <CreateWithThis item={item} />
        </div>

        <RecommendStrip item={item} onSelect={onSelectRecommend} />
      </div>

      {/* ── 右栏：作者 → 操作 → 元信息 ── */}
      <aside
        className={cn(
          'space-y-3',
          variant === 'page' && 'lg:sticky lg:top-24'
        )}
      >
        <div className='hidden space-y-3 lg:block'>
          <AuthorCard
            authorId={item.author_id}
            author={item.author}
            badge={item.author_badge}
          />

          <PrimaryActions
            favorited={Boolean(favorited)}
            onToggleFavorite={() => onToggleFavorite?.(item.id)}
            onCreate={scrollToCreate}
          />
        </div>

        <MetaSection
          title={t('Version details', { defaultValue: '版本详情' })}
        >
          <KeyValueRow label={t('Type', { defaultValue: '类型' })}>
            {typeLabel}
          </KeyValueRow>
          <KeyValueRow label={t('Status', { defaultValue: '状态' })}>
            {t('Published', { defaultValue: '已发布' })}
          </KeyValueRow>
          <KeyValueRow label={t('Published at', { defaultValue: '发布时间' })}>
            {formatPublishDate(item.created_at)}
          </KeyValueRow>
          <KeyValueRow label={t('Views', { defaultValue: '浏览' })}>
            {item.views}
          </KeyValueRow>
          <KeyValueRow label={t('Likes', { defaultValue: '点赞' })}>
            {likeCount ?? item.likes}
          </KeyValueRow>
          <KeyValueRow label={t('Base model', { defaultValue: '基础模型' })}>
            {item.model || '—'}
          </KeyValueRow>
        </MetaSection>

        <MetaSection
          title={t('Prompt parameters', { defaultValue: '使用参数' })}
        >
          <KeyValueRow label={t('Category', { defaultValue: '分类' })}>
            {item.category || '—'}
          </KeyValueRow>
          <KeyValueRow label={t('Language', { defaultValue: '语言' })}>
            {item.prompt_en?.trim()
              ? t('Chinese & English', { defaultValue: '中英双语' })
              : t('Chinese', { defaultValue: '中文' })}
          </KeyValueRow>
          {tags.length > 0 && (
            <KeyValueRow label={t('Tags', { defaultValue: '标签' })}>
              <div className='flex flex-wrap gap-1'>
                {tags.slice(0, 6).map((tag) => (
                  <button
                    key={tag}
                    type='button'
                    onClick={() => onTagSelect?.(tag)}
                    className='rounded-[4px] bg-muted px-1.5 py-[2px] text-[11px] text-muted-foreground transition-colors hover:text-foreground'
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            </KeyValueRow>
          )}
        </MetaSection>

        <MetaSection title={t('Usage notes', { defaultValue: '使用说明' })}>
          <ul className='space-y-1.5 px-3.5 py-3 text-[12px] leading-relaxed text-muted-foreground'>
            <li>
              {t('Prompt is free to copy and adapt.', {
                defaultValue: '提示词可自由复制、修改与商用。',
              })}
            </li>
            <li>
              {t('Example images belong to their authors.', {
                defaultValue: '示例图版权归发布者，转载请标注来源。',
              })}
            </li>
            {item.author && (
              <li>
                {t('Credit', { defaultValue: '来源' })}：@{item.author}
              </li>
            )}
          </ul>
        </MetaSection>

        {onLike ? (
          <button
            type='button'
            onClick={() => onLike(item)}
            disabled={liked}
            className={cn(
              'w-full rounded-lg border px-3 py-2 text-[12.5px] transition-colors',
              liked
                ? 'border-primary/40 bg-primary/10 text-primary'
                : 'border-border/60 bg-card text-muted-foreground hover:text-foreground'
            )}
          >
            {liked
              ? t('You liked this', { defaultValue: '已点赞' })
              : t('Like this work', { defaultValue: '点赞这份作品' })}
          </button>
        ) : null}

        {onShare && (
          <button
            type='button'
            onClick={() => onShare(item)}
            className='w-full rounded-lg border border-border/60 bg-card px-3 py-2 text-[12.5px] text-muted-foreground transition-colors hover:text-foreground'
          >
            {t('Share work', { defaultValue: '分享作品' })}
          </button>
        )}

        <DetailDisclaimer />
      </aside>

      {viewerIndex !== null && (
        <MediaLightbox
          item={item}
          media={media}
          index={viewerIndex}
          onIndexChange={setViewerIndex}
          onClose={() => setViewerIndex(null)}
          likeCount={likeCount}
          liked={liked}
          onLike={() => onLike?.(item)}
          onCreate={() => {
            setViewerIndex(null)
            // 等查看器卸载后再滚，避免 body 滚动锁把定位吞掉
            window.setTimeout(scrollToCreate, 80)
          }}
        />
      )}
    </div>
  )
}
