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
import { ComboInput } from '@/components/ui/combo-input'
import {
  extractGenerationMeta,
  normalizePromptText,
} from '@/lib/comfy-metadata'
import { getUserModels } from '@/lib/api'
import { translatePromptToEnglish } from '@/lib/prompt-translate'
import { useResolvedImageUrl } from '@/lib/storage'
import { toast } from 'sonner'
import { Languages, Loader2 } from 'lucide-react'

import type { PromptGallerySubmit } from './api'
import type { PromptGalleryItem } from './types'
import {
  useCreatePromptGallery,
  useDeletePromptGallery,
  useMyPromptGalleries,
  usePromptGalleryFacets,
  useUpdatePromptGallery,
} from './hooks/use-prompt-gallery'
import { useGalleryFormFields } from './use-form-fields'

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
  // 模型名与标签的候选项：来自后台「画廊预设」+ 库里已有的真实值
  const { data: facets } = usePromptGalleryFacets()
  const modelOptions = facets?.models ?? []
  const tagOptions = facets?.tags ?? []
  const categoryOptions = facets?.categories ?? []
  // 投稿表单字段显隐：后台「Fork settings → 画廊预设」的 GalleryFormFields 控制
  const { visible: fieldVisible } = useGalleryFormFields()
  const createMutation = useCreatePromptGallery()
  const updateMutation = useUpdatePromptGallery()
  const deleteMutation = useDeletePromptGallery()

  const [translating, setTranslating] = useState(false)

  const items = data?.items ?? []

  /**
   * 用站内模型把提示词翻成英文，填进「英文提示词」字段。
   *
   * 为什么值得做：中文提示词对海外用户和英文搜索都是死水，
   * 而 prompt_en 会进详情页正文与 sitemap。让用户手打一遍英文不现实，
   * 一次点击的成本才是可接受的。
   *
   * 模型选择：翻译走 /pg/chat/completions，Distribute 按模型名路由到渠道。
   * 不传 model 时后端拿不到路由目标直接报错 —— 所以必须先从
   * 用户可用模型里挑一个（优先选像是对话模型的），一个都没有时
   * 给出「请先配置渠道」的明确指引，而不是笼统的翻译失败。
   */
  const pickChatModel = async (): Promise<string | null> => {
    try {
      const res = await getUserModels()
      const names = res.data ?? []
      if (!names.length) return null
      // 优先挑名字里带对话模型特征的；否则用第一个
      const chatLike = names.find((n) =>
        /chat|gpt|claude|gemini|glm|qwen|deepseek|mistral|kimi|doubao/i.test(n)
      )
      return chatLike || names[0]
    } catch {
      return null
    }
  }

  const handleTranslate = async () => {
    const source = form.prompt.trim()
    if (!source) {
      toast.error(t('Fill in the prompt first'))
      return
    }
    setTranslating(true)
    try {
      const model = await pickChatModel()
      if (!model) {
        toast.error(t('No available model. Ask the admin to enable a channel first.'))
        return
      }
      const translated = await translatePromptToEnglish(source, model)
      if (!translated) {
        toast.error(t('Translation failed, please try again later'))
        return
      }
      set('prompt_en', translated)
      toast.success(t('English prompt filled in'))
    } finally {
      setTranslating(false)
    }
  }

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

  /**
   * 用户选中封面图时，尝试从图片里把生成参数捞出来自动填表。
   *
   * 覆盖 ComfyUI（PNG tEXt 里的 prompt/workflow）与 A1111（parameters）。
   * 这是投稿转化的关键：让 ComfyUI 用户不用回节点界面手动抄几百字提示词。
   *
   * 三条克制原则：
   * 1. 只填**空字段**，绝不覆盖用户已经手写的内容；
   * 2. 认不出来就静默跳过，不弹错、不打断上传；
   * 3. 只填能确定映射的字段（提示词/模型/标签），不臆造分类。
   */
  const handleCoverSelected = async (file: File) => {
    const meta = await extractGenerationMeta(file)
    if (!meta?.prompt) return

    const prompt = normalizePromptText(meta.prompt)
    if (!prompt) return

    // 先算好「要填什么」，再一次性 patch —— 避免在 updater 里做判断与计数
    // （StrictMode 下 updater 会跑两次，且 React 19 的执行时机不保证）。
    const patch: Partial<PromptGallerySubmit> = {}
    if (!form.prompt.trim()) patch.prompt = prompt
    if (!form.model.trim() && meta.model) patch.model = meta.model
    if (!form.title.trim()) {
      const firstClause = prompt.split(/[,，.。\n]/)[0]?.trim() ?? ''
      patch.title = firstClause.slice(0, 40)
    }
    // 负向提示词塞进标签，方便复现时参考（用户可自行改掉）
    if (meta.negativePrompt && !form.tags.trim()) {
      patch.tags = meta.negativePrompt
        .split(/[,，]/)
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 6)
        .join(', ')
    }

    const fillKeys = (['prompt', 'model', 'tags'] as const).filter(
      (k) => patch[k] !== undefined
    )
    setForm((f) => ({ ...f, ...patch }))
    if (fillKeys.length === 0) return

    const sourceLabel =
      meta.source === 'comfyui' ? 'ComfyUI' : 'Stable Diffusion'
    toast.success(
      t('Detected {{source}} metadata, prompt filled in', {
        source: sourceLabel,
      })
    )
  }

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

            {fieldVisible('prompt_en') && (
            <div className='space-y-1.5'>
              <div className='flex items-center justify-between'>
                <Label htmlFor='prompt-en'>
                  {t('English prompt')}
                  <span className='ml-1 text-xs font-normal text-muted-foreground'>
                    ({t('optional')})
                  </span>
                </Label>
                <Button
                  type='button'
                  variant='ghost'
                  size='sm'
                  className='h-6 gap-1 px-1.5 text-xs text-muted-foreground hover:text-foreground'
                  onClick={handleTranslate}
                  disabled={translating || !form.prompt.trim()}
                >
                  {translating ? (
                    <Loader2 className='size-3 animate-spin' />
                  ) : (
                    <Languages className='size-3' />
                  )}
                  {translating ? t('Translating…') : t('Auto translate')}
                </Button>
              </div>
              <Textarea
                id='prompt-en'
                value={form.prompt_en ?? ''}
                onChange={(e) => set('prompt_en', e.target.value)}
                placeholder={t('English version of the prompt for bilingual display')}
                rows={3}
              />
            </div>
            )}

            {(fieldVisible('model') || fieldVisible('type')) && (
            <div className='grid grid-cols-2 gap-3'>
              {fieldVisible('model') && (
              <div className='space-y-1.5'>
                <Label htmlFor='model'>{t('Model')}</Label>
                <ComboInput
                  value={form.model}
                  onChange={(v) => set('model', v)}
                  options={modelOptions}
                  placeholder={t('Pick or type a model')}
                />
              </div>
              )}
              {fieldVisible('type') && (
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
              )}
            </div>
            )}

            {fieldVisible('cover') && (
            <div className='space-y-1.5'>
              <Label htmlFor='cover'>{t('Cover image')}</Label>
              <ImageUpload
                value={form.cover}
                onChange={(url) => set('cover', url)}
                onFileSelected={(file) => void handleCoverSelected(file)}
                placeholder={t('Upload a cover image')}
              />
              <p className='text-xs text-muted-foreground'>
                {t(
                  'ComfyUI or Stable Diffusion PNGs will auto-fill the prompt.'
                )}
              </p>
            </div>
            )}

            {(fieldVisible('category') || fieldVisible('tags')) && (
            <div className='grid grid-cols-2 gap-3'>
              {fieldVisible('category') && (
              <div className='space-y-1.5'>
                <Label htmlFor='category'>{t('Category')}</Label>
                {/* 下拉预设 + 手输兜底：预设来自后台维护的 facets（与画廊筛选项同源） */}
                <ComboInput
                  value={form.category}
                  onChange={(v) => set('category', v)}
                  options={categoryOptions}
                  placeholder={t('Pick or type a category')}
                />
              </div>
              )}
              {fieldVisible('tags') && (
              <div className='space-y-1.5'>
                <Label htmlFor='tags'>{t('Tags')}</Label>
                <ComboInput
                  value={form.tags}
                  onChange={(v) => set('tags', v)}
                  options={tagOptions}
                  placeholder={t('Pick or type tags, comma separated')}
                />
              </div>
              )}
            </div>
            )}
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
