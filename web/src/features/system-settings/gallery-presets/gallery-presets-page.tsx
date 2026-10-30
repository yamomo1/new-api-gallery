/**
 * 画廊预设管理（管理员，路径 /system-settings/gallery-presets）
 * ------------------------------------------------------------------
 * 维护三件事，全部走 Option 存储，改完即时生效、不需要发版：
 *
 * 1. 预设模型名 —— 筛选栏 / 投稿表单下拉里的候选
 * 2. 预设标签   —— 同上
 * 3. 投稿表单字段 —— 逗号分隔的字段名，控制投稿弹窗渲染哪些字段块
 *
 * 三个 Option 的默认值在 `model/option.go` 注册。注意：
 * - 预设值是「补充」而非「覆盖」：`model.GetPromptGalleryFacets()` 会把
 *   库里已有的真实值排在前面，预设值去重后补在后面。
 * - 必填字段（title/prompt/cover）即使从表单字段里删掉也会被前端强制保留，
 *   否则投稿校验必然卡死。
 */
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Loader2, Save, SlidersHorizontal, Tag, Wand2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

import {
  getOptionValue,
  useSystemOptions,
} from '@/features/system-settings/hooks/use-system-options'
import { useUpdateOption } from '@/features/system-settings/hooks/use-update-option'

const PRESET_KEYS = [
  'GalleryPresetModels',
  'GalleryPresetTags',
  'GalleryFormFields',
] as const

type PresetKey = (typeof PRESET_KEYS)[number]
type PresetMap = Record<PresetKey, string>

const DEFAULTS: PresetMap = {
  GalleryPresetModels:
    'gpt-image-2.5,gpt-image-1,Midjourney,Flux.1 Dev,Flux.1 Pro,SDXL,SD 1.5,Stable Diffusion 3.5,Seedream 4.0,Kling 2.1,Nano Banana,Ideogram 3',
  GalleryPresetTags:
    '人像,风景,赛博朋克,国风,插画,摄影,产品图,建筑,动漫,写实,极简,电影感',
  GalleryFormFields:
    'title,prompt,prompt_en,model,type,cover,category,tags',
}

/** 投稿表单可配置的字段（与前端 use-form-fields.ts 的 DEFAULT_FORM_FIELDS 一致） */
const FORM_FIELDS = [
  { key: 'title', label: '标题', required: true },
  { key: 'prompt', label: '提示词', required: true },
  { key: 'prompt_en', label: '英文提示词', required: false },
  { key: 'model', label: '模型', required: false },
  { key: 'type', label: '类型', required: false },
  { key: 'cover', label: '封面图', required: true },
  { key: 'category', label: '分类', required: false },
  { key: 'tags', label: '标签', required: false },
] as const

/** 逗号分隔串 → 去空去重的数组 */
function splitCSV(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export function GalleryPresetsPage() {
  const { t } = useTranslation()
  const { data: optionsResp, isLoading } = useSystemOptions()
  const options = optionsResp?.data
  const updateOption = useUpdateOption()

  const [form, setForm] = useState<PresetMap>(DEFAULTS)
  const [saving, setSaving] = useState(false)

  const initial = useMemo(
    () => getOptionValue(options, DEFAULTS as PresetMap),
    [options]
  )

  useEffect(() => {
    if (options) setForm(getOptionValue(options, DEFAULTS as PresetMap))
  }, [options])

  const set = (k: PresetKey, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const modelList = splitCSV(form.GalleryPresetModels)
  const tagList = splitCSV(form.GalleryPresetTags)
  const activeFields = useMemo(
    () => new Set(splitCSV(form.GalleryFormFields)),
    [form.GalleryFormFields]
  )

  function toggleField(key: string, on: boolean) {
    const next = new Set(activeFields)
    if (on) next.add(key)
    else next.delete(key)
    // 保持 FORM_FIELDS 的原始顺序，避免每次切换都把 Option 串打乱
    const ordered = FORM_FIELDS.filter((f) => next.has(f.key)).map((f) => f.key)
    set('GalleryFormFields', ordered.join(','))
  }

  async function save() {
    setSaving(true)
    try {
      let changed = 0
      for (const k of PRESET_KEYS) {
        if (form[k] !== initial[k]) {
          await updateOption.mutateAsync({ key: k, value: form[k] })
          changed += 1
        }
      }
      toast.success(
        changed > 0 ? t('Settings saved') : t('Nothing changed')
      )
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className='flex justify-center p-16'>
        <Loader2 className='size-6 animate-spin text-muted-foreground' />
      </div>
    )
  }

  return (
    <div className='mx-auto max-w-4xl space-y-6 p-6'>
      <div>
        <h2 className='flex items-center gap-2 text-lg font-semibold'>
          <SlidersHorizontal className='size-5' />
          画廊预设
        </h2>
        <p className='mt-1 text-sm text-muted-foreground'>
          维护画廊筛选栏与投稿表单里的
          <strong className='text-foreground'>模型名</strong>、
          <strong className='text-foreground'>标签</strong>
          候选值，以及投稿表单显示哪些字段。逗号分隔，改完即时生效，无需重新部署。
          这些是「补充项」：库里已有的真实值始终排在前面的。
        </p>
      </div>

      {/* 预设模型 */}
      <Card>
        <CardHeader className='pb-3'>
          <CardTitle className='flex items-center gap-2 text-base'>
            <Wand2 className='size-4' />
            预设模型名
            <span className='text-xs font-normal text-muted-foreground'>
              （已填 {modelList.length} 个）
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className='space-y-3'>
          <Input
            value={form.GalleryPresetModels}
            onChange={(e) => set('GalleryPresetModels', e.target.value)}
            placeholder='gpt-image-1,Midjourney,Flux.1 Dev'
          />
          <div className='flex flex-wrap gap-1.5'>
            {modelList.slice(0, 40).map((m) => (
              <Badge key={m} variant='secondary' className='font-normal'>
                {m}
              </Badge>
            ))}
            {modelList.length === 0 && (
              <span className='text-xs text-muted-foreground'>
                留空则只显示库里已有的模型
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 预设标签 */}
      <Card>
        <CardHeader className='pb-3'>
          <CardTitle className='flex items-center gap-2 text-base'>
            <Tag className='size-4' />
            预设标签
            <span className='text-xs font-normal text-muted-foreground'>
              （已填 {tagList.length} 个）
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className='space-y-3'>
          <Input
            value={form.GalleryPresetTags}
            onChange={(e) => set('GalleryPresetTags', e.target.value)}
            placeholder='人像,风景,赛博朋克'
          />
          <div className='flex flex-wrap gap-1.5'>
            {tagList.slice(0, 40).map((tag) => (
              <Badge key={tag} variant='secondary' className='font-normal'>
                {tag}
              </Badge>
            ))}
            {tagList.length === 0 && (
              <span className='text-xs text-muted-foreground'>
                留空则只显示库里已有的标签
              </span>
            )}
          </div>
          <p className='text-xs text-muted-foreground'>
            公开筛选栏最多展示按使用频次排序的前 24 个标签，预设值作为补充排在真实标签之后。
          </p>
        </CardContent>
      </Card>

      {/* 投稿表单字段 */}
      <Card>
        <CardHeader className='pb-3'>
          <CardTitle className='text-base'>投稿表单字段</CardTitle>
        </CardHeader>
        <CardContent className='space-y-3'>
          <div className='grid gap-2 sm:grid-cols-2'>
            {FORM_FIELDS.map((field) => {
              const on = field.required || activeFields.has(field.key)
              return (
                <div
                  key={field.key}
                  className='flex items-center justify-between rounded-md border px-3 py-2'
                >
                  <div className='flex items-center gap-2'>
                    <Label htmlFor={`field-${field.key}`} className='text-sm'>
                      {field.label}
                    </Label>
                    {field.required && (
                      <Badge variant='outline' className='text-[10px]'>
                        必填
                      </Badge>
                    )}
                  </div>
                  <Switch
                    id={`field-${field.key}`}
                    checked={on}
                    disabled={field.required}
                    onCheckedChange={(v) =>
                      toggleField(field.key, v === true)
                    }
                  />
                </div>
              )
            })}
          </div>
          <p className='text-xs text-muted-foreground'>
            关闭的字段不会出现在投稿/编辑弹窗里。标题、提示词、封面是提交校验的必需项，
            强制开启。
          </p>
        </CardContent>
      </Card>

      <div className='flex justify-end'>
        <Button onClick={save} disabled={saving}>
          {saving ? (
            <Loader2 className='mr-2 size-4 animate-spin' />
          ) : (
            <Save className='mr-2 size-4' />
          )}
          {t('Save')}
        </Button>
      </div>
    </div>
  )
}
