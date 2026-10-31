import { useTranslation } from 'react-i18next'
import {
  ChevronDown,
  ExternalLink,
  Eye,
  Heart,
  Share2,
  Sparkles,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { runningHubInviteUrl } from '@/features/canvas/runninghub'
import { cn } from '@/lib/utils'

import { CreateWithThis } from '../create-with-this'
import type { PromptGalleryItem } from '../types'
import { formatPublishDate, parseGalleryMedia, parseGalleryTags } from '../utils'
import { CommentSection } from './detail/comment-section'
import { WorkGallery } from './detail/work-gallery'
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
  /** 作品展示里的「做同款」：带 ?create=1 跳到该作品并滚到创作入口 */
  onCreateRecommend?: (id: number) => void
  /** page：常规页面（右栏 sticky 到顶栏下方）；dialog：全屏弹窗内滚动 */
  variant?: 'page' | 'dialog'
}

/**
 * 作品详情主体（按 liblib 模型页实测尺寸复刻）
 * ---------------------------------------------------------------
 * 实测基准（1440 视口，参考页）：
 *  - 容器 1236（含 16 内边距）→ 内容 1204；左栏 826 + 间隔 16 + 右栏 362
 *  - 标题 24px/500、行高 36
 *  - 标签 chip 12px、全圆角、padding 4×12、底色 #F4F5F9
 *  - 图片卡片 413×600、间距 8、圆角 13、底色 #F6F6F6、object-contain
 *  - 正文 14px / 行高 1.7 / #0F1419
 *  - 右栏：作者 → 操作 → 参数表 → 许可范围
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
  onCreateRecommend,
  variant = 'page',
}: GalleryDetailBodyProps) {
  const { t } = useTranslation()
  // 大图查看器当前图片下标；null = 关闭
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)
  // 提示词默认收 6 行，点「全部展开」再放全（对齐参考站的收起态）
  const [promptOpen, setPromptOpen] = useState(false)

  const media = useMemo(() => parseGalleryMedia(item), [item])
  const tags = useMemo(() => parseGalleryTags(item.tags), [item])

  useEffect(() => {
    setViewerIndex(null)
    setPromptOpen(false)
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
    <div>
      <div className='grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_362px]'>
      {/* ── 左栏：标题 → 标签 → 版本 → 图片 → 正文 → 教学 → 创作 → 讨论 → 相关 ── */}
      <div className='min-w-0'>
        <header>
          <h1 className='text-[26px] leading-tight font-semibold tracking-tight text-foreground md:text-[30px]'>
            {item.title}
          </h1>

          {/* 标签行：模型/类型/分类/话题 靠左，浏览点赞分享靠右 */}
          <div className='mt-3 flex flex-wrap items-center gap-2.5'>
            {item.model && (
              <MetaChip tone='primary'>
                <Sparkles className='mr-1 size-3' />
                {item.model}
              </MetaChip>
            )}
            <MetaChip>{typeLabel}</MetaChip>
            {item.category && <MetaChip>{item.category}</MetaChip>}
            {tags.map((tag) => (
              <button key={tag} type='button' onClick={() => onTagSelect?.(tag)}>
                <MetaChip>{`#${tag}`}</MetaChip>
              </button>
            ))}
            <div className='ml-auto flex items-center gap-3.5 text-[12px] text-foreground/80'>
              <span className='inline-flex items-center gap-1'>
                <Eye className='size-3.5 text-muted-foreground' />
                {item.views}
              </span>
              <span className='inline-flex items-center gap-1'>
                <Heart className='size-3.5 text-muted-foreground' />
                {likeCount ?? item.likes}
              </span>
              {onShare && (
                <button
                  type='button'
                  onClick={() => onShare(item)}
                  aria-label={t('Share work', { defaultValue: '分享作品' })}
                  className='text-muted-foreground transition-colors hover:text-foreground'
                >
                  <Share2 className='size-4' />
                </button>
              )}
            </div>
          </div>

          {/* 版本行：左侧版本号，右侧更新/首发时间（参考站有这一行） */}
          <div className='mt-3 flex flex-wrap items-center justify-between gap-2'>
            <span className='inline-flex items-center gap-1.5 text-[20px] leading-6 font-bold text-foreground'>
              <Sparkles className='size-4 text-[#E49026]' />
              v1
            </span>
            <p className='text-[12px] text-muted-foreground'>
              {t('Last updated', { defaultValue: '最近更新' })}：
              {formatPublishDate(item.updated_at)}
              <span className='ml-3'>
                {t('First published', { defaultValue: '首次发布' })}：
                {formatPublishDate(item.created_at)}
              </span>
            </p>
          </div>
        </header>

        {/* 移动端把作者与操作提到标题下方，避免滚到底才能收藏 */}
        <div className='mt-4 space-y-3 lg:hidden'>
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

        <div className='mt-4'>
          <MediaGallery
            item={item}
            media={media}
            onOpenViewer={setViewerIndex}
            onScrollToCreate={scrollToCreate}
          />
        </div>

        {/* 提示词正文：参考站是图片下方直接铺开的正文，不再收进卡片 */}
        <div className='mt-4'>
          <p
            className={cn(
              'text-[14px] leading-[1.7] whitespace-pre-wrap text-[#0f1419] dark:text-foreground/90',
              !promptOpen && 'line-clamp-6'
            )}
          >
            {item.prompt}
          </p>
          {item.prompt_en?.trim() && promptOpen && (
            <p className='mt-3 text-[14px] leading-[1.7] whitespace-pre-wrap text-muted-foreground'>
              {item.prompt_en}
            </p>
          )}
          <button
            type='button'
            onClick={() => setPromptOpen((v) => !v)}
            className='mt-2 inline-flex items-center gap-1 text-[13px] text-muted-foreground transition-colors hover:text-foreground'
          >
            {promptOpen
              ? t('Collapse', { defaultValue: '收起' })
              : t('Show all', { defaultValue: '全部展开' })}
            <ChevronDown
              className={cn('size-4 transition-transform', promptOpen && 'rotate-180')}
            />
          </button>
        </div>

        {/* 使用教学：三步 + RunningHub 入口（本站补充，参考站无） */}
        <section className='mt-6'>
          <h2 className='mb-2 text-[14px] font-medium text-foreground'>
            {t('How to use this prompt', { defaultValue: '使用教学' })}
          </h2>
          <ol className='space-y-1 text-[13px] leading-relaxed text-muted-foreground'>
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
          <a
            href={runningHubInviteUrl()}
            target='_blank'
            rel='noopener noreferrer'
            title={t('Opens RunningHub in a new tab with your invite code')}
            className='mt-2 inline-flex items-center gap-1 text-[12.5px] font-medium text-primary transition-colors hover:text-primary/80'
          >
            <ExternalLink className='size-3.5' />
            {t('Try on RunningHub')}
          </a>
        </section>

        <div id='gallery-create-with-this' className='mt-6 scroll-mt-24'>
          <CreateWithThis item={item} />
        </div>

        {/* 评论：真接口；列表公开，发表与删除需登录 */}
        <div className='mt-7'>
          <CommentSection
            galleryId={item.id}
            initialCount={item.comment_count ?? 0}
          />
        </div>

      </div>

      {/* ── 右栏：作者 → 操作 → 认证信息 → 参数 → 许可 ── */}
      <aside
        className={cn('space-y-2.5', variant === 'page' && 'lg:sticky lg:top-20')}
      >
        <div className='hidden space-y-2.5 lg:block'>
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

          <p className='px-0.5 text-[11.5px] text-muted-foreground'>
            {`${t('Certified work', { defaultValue: '已认证' })} · ${formatPublishDate(item.created_at)} ${t('Content generated by AI', { defaultValue: '内容由 AI 生成' })}`}
          </p>
        </div>

        <MetaSection title={t('Work details', { defaultValue: '作品详情' })}>
          <KeyValueRow label={t('Type', { defaultValue: '类型' })}>
            {typeLabel}
          </KeyValueRow>
          <KeyValueRow label={t('Base model', { defaultValue: '基础模型' })}>
            {item.model || '—'}
          </KeyValueRow>
          <KeyValueRow label={t('Category', { defaultValue: '分类' })}>
            {item.category || '—'}
          </KeyValueRow>
          <KeyValueRow label={t('Language', { defaultValue: '语言' })}>
            {item.prompt_en?.trim()
              ? t('Chinese & English', { defaultValue: '中英双语' })
              : t('Chinese', { defaultValue: '中文' })}
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
          {tags.length > 0 && (
            <KeyValueRow label={t('Tags', { defaultValue: '标签' })}>
              <div className='flex flex-wrap gap-1'>
                {tags.slice(0, 8).map((tag) => (
                  <button
                    key={tag}
                    type='button'
                    onClick={() => onTagSelect?.(tag)}
                    className='rounded bg-muted px-1.5 py-[2px] text-[11px] text-muted-foreground transition-colors hover:text-foreground'
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            </KeyValueRow>
          )}
        </MetaSection>

        <MetaSection title={t('License scope', { defaultValue: '许可范围' })}>
          <ul className='space-y-1.5 px-[9px] py-2.5 text-[12px] leading-relaxed text-muted-foreground'>
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
          </ul>
        </MetaSection>

        {onLike ? (
          <button
            type='button'
            onClick={() => onLike(item)}
            disabled={liked}
            className={cn(
              'flex h-10 w-full items-center justify-center gap-1.5 rounded-lg text-[13px] transition-colors',
              liked
                ? 'bg-[#FFF2D6] text-[#E49026] dark:bg-primary/15 dark:text-primary'
                : 'bg-[#F2F5F9] text-muted-foreground hover:text-foreground dark:bg-muted'
            )}
          >
            <Heart className={cn('size-4', liked && 'fill-current')} />
            {liked
              ? t('You liked this', { defaultValue: '已点赞' })
              : t('Like this work', { defaultValue: '点赞这份作品' })}
          </button>
        ) : null}

        <DetailDisclaimer />
      </aside>
      </div>

      {/* 作品展示：拉通整行，和上方内容同宽 */}
      <div className='mt-10'>
        <WorkGallery
          item={item}
          onSelect={onSelectRecommend}
          onOpenCreate={onCreateRecommend}
        />
      </div>

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
