import { useTranslation } from 'react-i18next'
import { ExternalLink, Video } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { runningHubInviteUrl } from '@/features/canvas/runninghub'
import { cn } from '@/lib/utils'
import { resolveImageUrl } from '@/lib/storage'

import { CreateWithThis } from '../create-with-this'
import type { PromptGalleryItem } from '../types'
import { isVideoUrl, parseGalleryMedia, parseGalleryTags } from '../utils'
import { RecommendStrip } from './recommend-strip'
import { GenerationInfo } from './detail/generation-info'
import {
  AuthorCard,
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
  const [activeMedia, setActiveMedia] = useState(0)

  const media = useMemo(() => parseGalleryMedia(item), [item])
  const tags = useMemo(() => parseGalleryTags(item.tags), [item])
  const index = Math.min(activeMedia, Math.max(media.length - 1, 0))
  const current = media[index]

  useEffect(() => {
    setActiveMedia(0)
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

  // 媒体节点提前算好：避免在 JSX 里写三元嵌套
  let mediaNode = (
    <div className='flex aspect-video w-full items-center justify-center text-muted-foreground/50'>
      <Video className='size-9' />
    </div>
  )
  if (current) {
    mediaNode = isVideoUrl(current) ? (
      <video
        key={current}
        src={current}
        controls
        autoPlay
        loop
        muted
        playsInline
        poster={resolveImageUrl(item.cover)}
        className='max-h-[78vh] w-full rounded-lg object-contain'
      />
    ) : (
      <img
        key={current}
        src={current}
        alt={item.title}
        className='max-h-[78vh] w-full rounded-lg object-contain'
      />
    )
  }

  return (
    <div className='grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-7'>
      {/* ── 左栏：标题 → 媒体 → 提示词 → 去创作 → 推荐 ── */}
      <div className='min-w-0 space-y-6'>
        <header>
          <h1 className='text-[21px] leading-snug font-semibold tracking-tight md:text-[25px]'>
            {item.title}
          </h1>
          <div className='mt-2.5 flex flex-wrap items-center gap-1.5'>
            {item.model && <MetaChip tone='primary'>{item.model}</MetaChip>}
            <MetaChip>{typeLabel}</MetaChip>
            {item.category && <MetaChip>{item.category}</MetaChip>}
            {tags.map((tag) => (
              <button
                key={tag}
                type='button'
                onClick={() => onTagSelect?.(tag)}
                className='rounded-md bg-muted px-2 py-[3px] text-[11.5px] leading-none text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground'
              >
                #{tag}
              </button>
            ))}
          </div>
        </header>

        {/* 移动端把作者与操作提到标题下方，避免用户滚到底部才能收藏 */}
        <div className='space-y-3 lg:hidden'>
          <AuthorCard
            author={item.author}
            views={item.views}
            likes={likeCount ?? item.likes}
            createdAt={item.created_at}
          />
          <PrimaryActions
            favorited={Boolean(favorited)}
            onToggleFavorite={() => onToggleFavorite?.(item.id)}
            onCreate={scrollToCreate}
          />
        </div>

        {/* 媒体：浅色卡片承托，多图用底部缩略图切换 */}
        <div className='overflow-hidden rounded-xl border border-border/60 bg-muted/40'>
          <div className='flex items-center justify-center p-2 md:p-3'>
            {mediaNode}
          </div>

          {media.length > 1 && (
            <div className='flex gap-2 overflow-x-auto border-t border-border/50 px-2.5 py-2.5'>
              {media.map((src, i) => (
                <button
                  key={src}
                  type='button'
                  aria-label={`${i + 1}`}
                  aria-pressed={i === index}
                  onClick={() => setActiveMedia(i)}
                  className={cn(
                    'size-12 shrink-0 overflow-hidden rounded-md border-2 transition-colors',
                    i === index
                      ? 'border-primary'
                      : 'border-transparent opacity-65 hover:opacity-100'
                  )}
                >
                  {isVideoUrl(src) ? (
                    <span className='flex size-full items-center justify-center bg-muted'>
                      <Video className='size-4 text-muted-foreground' />
                    </span>
                  ) : (
                    <img
                      src={resolveImageUrl(src)}
                      alt=''
                      className='size-full object-cover'
                    />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 生成信息：模型 + 提示词（长提示词在卡片内部滚动，不撑高页面） */}
        <GenerationInfo item={item} />

        <section>
          <h2 className='mb-2.5 text-[15px] font-semibold text-foreground'>
            {t('How to use this prompt', { defaultValue: '使用教学' })}
          </h2>
          <div className='rounded-xl border border-border/60 bg-card px-4 py-3.5'>
            <ol className='space-y-1.5 text-[12.5px] leading-relaxed text-muted-foreground'>
              <li>
                1.{' '}
                {t('Copy the prompt above', {
                  defaultValue: '复制上方提示词',
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
            author={item.author}
            views={item.views}
            likes={likeCount ?? item.likes}
            createdAt={item.created_at}
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
    </div>
  )
}
