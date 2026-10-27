/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

/**
 * 首页设置（二开设置 → 首页设置）
 * ------------------------------------------------------------------
 * 编辑画廊首页内容，分两块：
 * - 文案：按语种各存一份（顶部切换语种），某语种没填会回退英文、再回退内置默认
 * - 共享资源：视频轮播、链接、图片路径、开关、时长——跨语种共用一个值
 *
 * 存储为 HomeConfig option（JSON），公开接口 GET /api/home_config 供首页读取。
 * 结构见 features/gallery-home/schema.ts 的 v2 说明。
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  Check,
  Eraser,
  Loader2,
  Plus,
  RotateCcw,
  Save,
  Search,
  Trash2,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

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
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  getSystemOptions,
  updateSystemOption,
} from '@/features/system-settings/api'
import { buildHomeData, buildMotionData, mergeHomeConfig } from '@/features/gallery-home/data'
import {
  HOME_FALLBACK_LOCALE,
  HOME_LOCALE_LABELS,
  HOME_LOCALES,
} from '@/features/gallery-home/locales'
import {
  homeConfigV2Schema,
  normalizeHomeConfig,
} from '@/features/gallery-home/schema'
import {
  SHARED_GROUPS,
  TEXT_FIELD_PATHS,
  TEXT_GROUPS,
  TOTAL_TEXT_FIELDS,
  type Field,
  type FieldGroup,
} from './field-groups'
import { TranslateCard } from './translate-card'
import { ModelItemsCard, type ModelItem } from './model-items-card'
import {
  GalleryItemsCard,
  type GallerySource,
  type GalleryWork,
} from './gallery-items-card'

const HOME_CONFIG_KEY = 'HomeConfig'

type Cfg = Record<string, unknown>

type Draft = {
  version: 2
  locales: Record<string, Cfg>
  shared: Cfg
}

const EMPTY_DRAFT: Draft = { version: 2, locales: {}, shared: {} }

/* ------------------------------------------------------------------ */
/* 路径读写：支持 a.b.0.c 数组下标，全程不可变                        */
/* ------------------------------------------------------------------ */

function isPlainObj(v: unknown): v is Cfg {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

const isIndex = (k: string | undefined) => !!k && /^\d+$/.test(k)

function getPath(obj: unknown, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>(
      (acc, k) => (acc && typeof acc === 'object' ? (acc as Cfg)[k] : undefined),
      obj,
    )
}

function setPath(node: unknown, keys: string[], value: unknown): unknown {
  const [k, ...rest] = keys
  const idx = Number(k)
  // 数组（或需要新建数组）分支：按下标写入，保持数组类型
  if (Array.isArray(node) || (isIndex(k) && !isPlainObj(node))) {
    if (!Number.isInteger(idx)) return node
    const arr: unknown[] = Array.isArray(node) ? [...node] : []
    arr[idx] = rest.length ? setPath(arr[idx], rest, value) : value
    return arr
  }
  const base: Cfg = isPlainObj(node) ? { ...node } : {}
  if (rest.length === 0) {
    base[k] = value
    return base
  }
  base[k] = setPath(base[k], rest, value)
  return base
}

/** 删除某条覆盖（数组下标路径不 splice，避免错位） */
function deletePath(node: unknown, keys: string[]): unknown {
  const [k, ...rest] = keys
  if (Array.isArray(node)) {
    const idx = Number(k)
    if (!Number.isInteger(idx)) return node
    const copy = [...node]
    copy[idx] = rest.length ? deletePath(node[idx], rest) : undefined
    return copy
  }
  if (!isPlainObj(node)) return node
  const copy: Cfg = { ...node }
  if (rest.length === 0) {
    delete copy[k]
    return copy
  }
  const child = deletePath(node[k], rest)
  if (child === undefined || (isPlainObj(child) && !Object.keys(child).length)) {
    delete copy[k]
  } else {
    copy[k] = child
  }
  return copy
}

/** 清掉空串/空对象/空数组，避免把一堆 null 存进 option */
function prune(node: unknown): unknown {
  if (Array.isArray(node)) {
    const arr = node.map(prune).filter((v) => v !== undefined && v !== null && v !== '')
    return arr.length ? arr : undefined
  }
  if (isPlainObj(node)) {
    const out: Cfg = {}
    for (const [k, v] of Object.entries(node)) {
      const p = prune(v)
      if (p !== undefined) out[k] = p
    }
    return Object.keys(out).length ? out : undefined
  }
  return node === '' || node === null || node === undefined ? undefined : node
}

const asText = (v: unknown): string => {
  if (v === undefined || v === null) return ''
  return Array.isArray(v) ? v.join('，') : String(v)
}

const splitList = (value: string): string[] =>
  value
    .split(/[,，]/)
    .map((s) => s.trim())
    .filter(Boolean)

/* ------------------------------------------------------------------ */

export function HomeSettings() {
  const { t, i18n } = useTranslation()
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT)
  const [lang, setLang] = useState<string>(HOME_FALLBACK_LOCALE)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [migrated, setMigrated] = useState(false)
  const [search, setSearch] = useState('')
  /** 当前编辑的分区（lang / 各文案组 key / shared），一次只渲染一屏 */
  const [tab, setTab] = useState<string>('hero')

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const res = await getSystemOptions()
        const raw = res?.data?.find((o) => o.key === HOME_CONFIG_KEY)?.value
        let parsed: ReturnType<typeof normalizeHomeConfig> | null = null
        let wasLegacy = false
        if (typeof raw === 'string' && raw.trim() !== '' && raw !== 'null') {
          const obj = JSON.parse(raw) as Cfg
          wasLegacy = !(obj.version === 2 || obj.locales || obj.shared)
          parsed = normalizeHomeConfig(obj)
        }
        if (!alive) return
        setMigrated(wasLegacy)
        setDraft({
          version: 2,
          locales: (parsed?.locales as Record<string, Cfg>) ?? {},
          shared: (parsed?.shared as Cfg) ?? {},
        })
      } catch {
        if (!alive) return
        toast.error(t('Failed to load home settings, fell back to defaults'))
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [t])

  /* 未保存提醒 */
  useEffect(() => {
    if (!dirty) return
    const handler = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  /** 内置默认值：按「当前编辑语种」生成，作为回退值与 placeholder */
  const baseForLang = useMemo(() => {
    const fixed = i18n.getFixedT(lang)
    const tt = (key: string) => {
      const v = fixed(key)
      return typeof v === 'string' ? v : String(v ?? key)
    }
    return buildHomeData(tt)
  }, [i18n, lang])

  /** 界面语言下的内置默认（共享字段的 placeholder 用） */
  const baseAll = useMemo(() => {
    const tt = (key: string) => {
      const v = i18n.getFixedT(i18n.language)(key)
      return typeof v === 'string' ? v : String(v ?? key)
    }
    return { ...buildHomeData(tt), motion: buildMotionData(tt) }
  }, [i18n])

  /** 文案字段的回退值：内置默认 → locales[en] → shared */
  const fallbackResolved = useMemo(() => {
    const layers: unknown[] =
      lang === HOME_FALLBACK_LOCALE
        ? [draft.shared]
        : [draft.locales[HOME_FALLBACK_LOCALE], draft.shared]
    return layers.reduce(
      (acc, layer) => mergeHomeConfig(acc, layer),
      baseForLang as unknown,
    ) as unknown
  }, [baseForLang, draft.locales, draft.shared, lang])

  /** 共享字段的回退值：内置默认 → shared */
  const sharedResolved = useMemo(
    () => mergeHomeConfig(baseAll, draft.shared) as unknown,
    [baseAll, draft.shared],
  )

  const localeDraft = draft.locales[lang] ?? {}

  const countFilled = useCallback(
    (code: string) => {
      const bucket = draft.locales[code]
      if (!bucket) return 0
      return TEXT_FIELD_PATHS.filter((p) => {
        const v = getPath(bucket, p)
        return v !== undefined && v !== null && v !== ''
      }).length
    },
    [draft.locales],
  )

  /* ---------------------------- 写入 ---------------------------- */

  const patch = useCallback((fn: (d: Draft) => Draft) => {
    setDraft((prev) => fn(prev))
    setDirty(true)
  }, [])

  const setLocaleValue = useCallback(
    (path: string, value: string, type?: Field['type']) => {
      patch((prev) => {
        const bucket = prev.locales[lang] ?? {}
        const next =
          value === ''
            ? (deletePath(bucket, path.split('.')) as Cfg)
            : (setPath(bucket, path.split('.'), type === 'list' ? splitList(value) : value) as Cfg)
        return { ...prev, locales: { ...prev.locales, [lang]: next } }
      })
    },
    [lang, patch],
  )

  const clearLocaleValue = useCallback(
    (path: string) => {
      patch((prev) => ({
        ...prev,
        locales: {
          ...prev.locales,
          [lang]: (deletePath(prev.locales[lang] ?? {}, path.split('.')) as Cfg) ?? {},
        },
      }))
    },
    [lang, patch],
  )

  const setSharedValue = useCallback(
    (path: string, value: unknown) => {
      patch((prev) => ({
        ...prev,
        shared:
          value === '' || value === undefined
            ? ((deletePath(prev.shared, path.split('.')) as Cfg) ?? {})
            : (setPath(prev.shared, path.split('.'), value) as Cfg),
      }))
    },
    [patch],
  )

  /** 批量：把所有还空着的文案字段填成当前回退值 */
  const fillEmptyFromFallback = useCallback(() => {
    let filled = 0
    patch((prev) => {
      const bucket = prev.locales[lang] ?? {}
      let next = bucket
      for (const path of TEXT_FIELD_PATHS) {
        const current = getPath(bucket, path)
        if (current !== undefined && current !== null && current !== '') continue
        const fallback = getPath(fallbackResolved, path)
        if (fallback === undefined || fallback === null || fallback === '') continue
        next = setPath(next, path.split('.'), fallback) as Cfg
        filled += 1
      }
      return { ...prev, locales: { ...prev.locales, [lang]: next } }
    })
    toast.success(
      filled
        ? `${filled} ${t('fields filled')}`
        : t('Nothing to fill, every field already has a value'),
    )
  }, [fallbackResolved, lang, patch, t])

  const clearLanguage = useCallback(() => {
    patch((prev) => {
      const locales = { ...prev.locales }
      delete locales[lang]
      return { ...prev, locales }
    })
    toast.success(t('Overrides cleared for this language'))
  }, [lang, patch, t])

  /** 自动翻译用：把译文写进「指定语种」桶的某字段（不经过当前编辑语种） */
  const writeField = useCallback(
    (locale: string, path: string, value: unknown) => {
      patch((prev) => {
        const bucket = prev.locales[locale] ?? {}
        const cleaned = prune(value)
        const next =
          cleaned === undefined || cleaned === ''
            ? ((deletePath(bucket, path.split('.')) as Cfg) ?? {})
            : (setPath(bucket, path.split('.'), cleaned) as Cfg)
        return { ...prev, locales: { ...prev.locales, [locale]: next } }
      })
    },
    [patch],
  )

  /* ---------------------------- 保存 / 重置 ---------------------------- */

  const save = async () => {
    setSaving(true)
    try {
      const payload = prune({
        version: 2,
        locales: draft.locales,
        shared: draft.shared,
      })
      const parsed = homeConfigV2Schema.safeParse(payload ?? {})
      if (!parsed.success) {
        const first = parsed.error.issues[0]
        toast.error(
          `${t('Home settings validation failed')}: ${first?.path?.join('.') || ''} ${first?.message || ''}`,
        )
        return
      }
      const res = await updateSystemOption({
        key: HOME_CONFIG_KEY,
        value: JSON.stringify(parsed.data),
      })
      if (res?.success === false) {
        toast.error(res.message || t('Save failed'))
        return
      }
      setDirty(false)
      setMigrated(false)
      toast.success(t('Home settings saved, refresh the homepage to see it'))
    } catch {
      toast.error(t('Save failed, please retry later'))
    } finally {
      setSaving(false)
    }
  }

  const resetAll = async () => {
    setSaving(true)
    try {
      const res = await updateSystemOption({ key: HOME_CONFIG_KEY, value: '' })
      if (res?.success === false) {
        toast.error(res.message || t('Save failed'))
        return
      }
      setDraft(EMPTY_DRAFT)
      setDirty(false)
      setMigrated(false)
      toast.success(t('Everything reset to the built-in defaults'))
    } catch {
      toast.error(t('Save failed, please retry later'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className='flex items-center justify-center gap-2 py-24 text-muted-foreground'>
        <Loader2 className='size-4 animate-spin' /> {t('Loading…')}
      </div>
    )
  }

  /* ---------------------------- 视频轮播 ---------------------------- */

  const videos =
    (getPath(draft.shared, 'motion.heroVideo.videos') as string[] | undefined) ??
    (getPath(baseAll, 'motion.heroVideo.videos') as string[] | undefined) ??
    []

  const writeVideos = (next: string[]) =>
    setSharedValue('motion.heroVideo.videos', next)

  const moveVideo = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= videos.length) return
    const next = [...videos]
    ;[next[i], next[j]] = [next[j], next[i]]
    writeVideos(next)
  }

  /* ---------------------------- 渲染 ---------------------------- */

  const query = search.trim().toLowerCase()
  const matches = (f: Field, group: FieldGroup) =>
    !query ||
    f.label.toLowerCase().includes(query) ||
    f.path.toLowerCase().includes(query) ||
    group.title.toLowerCase().includes(query)

  const filledNow = countFilled(lang)

  const renderField = (f: Field, fallback: string) => {
    if (f.type === 'switch') {
      const own = getPath(draft.shared, f.path)
      const checked = typeof own === 'boolean' ? own : getPath(baseAll, f.path) !== false
      return (
        <div className='flex items-center justify-between gap-3 rounded-md border px-3 py-2'>
          <div className='min-w-0'>
            <Label className='block text-xs'>{t(f.label)}</Label>
            <p className='truncate font-mono text-[11px] text-muted-foreground'>{f.path}</p>
          </div>
          <Switch checked={!!checked} onCheckedChange={(v) => setSharedValue(f.path, v)} />
        </div>
      )
    }

    if (f.type === 'number') {
      const own = getPath(draft.shared, f.path)
      return (
        <div className='space-y-1.5'>
          <Label className='block text-xs'>{t(f.label)}</Label>
          <Input
            type='number'
            step='any'
            value={own === undefined ? '' : String(own)}
            placeholder={fallback}
            onChange={(e) =>
              setSharedValue(f.path, e.target.value === '' ? '' : Number(e.target.value))
            }
          />
        </div>
      )
    }

    // 共享字段（非 switch / number）：视频路径、链接、图片列表
    const own = getPath(draft.shared, f.path)
    return (
      <div className={f.type === 'list' ? 'space-y-1.5 md:col-span-2' : 'space-y-1.5'}>
        <Label className='block text-xs'>{t(f.label)}</Label>
        <Input
          value={asText(own)}
          placeholder={fallback}
          onChange={(e) => setSharedValue(f.path, e.target.value)}
        />
      </div>
    )
  }

  const renderTextField = (f: Field) => {
    const own = getPath(localeDraft, f.path)
    const fallback = asText(getPath(fallbackResolved, f.path))
    const overridden = own !== undefined && own !== null && own !== ''
    const viaEnglish =
      !overridden &&
      lang !== HOME_FALLBACK_LOCALE &&
      getPath(draft.locales[HOME_FALLBACK_LOCALE] ?? {}, f.path) !== undefined

    return (
      <div className={f.type === 'textarea' ? 'space-y-1.5 md:col-span-2' : 'space-y-1.5'}>
        <div className='flex items-center justify-between gap-2'>
          <Label className='text-xs'>{t(f.label)}</Label>
          <div className='flex shrink-0 items-center gap-1'>
            {overridden ? (
              <Badge variant='secondary' className='gap-1'>
                <Check className='size-3' /> {t('Overridden')}
              </Badge>
            ) : viaEnglish ? (
              <Badge variant='outline'>{t('From English')}</Badge>
            ) : (
              <Badge variant='outline' className='text-muted-foreground'>
                {t('Default')}
              </Badge>
            )}
            {!overridden && fallback && (
              <Button
                variant='ghost'
                size='icon'
                className='size-6'
                title={t('Use fallback value')}
                aria-label={t('Use fallback value')}
                onClick={() => setLocaleValue(f.path, fallback, f.type)}
              >
                <ArrowDown className='size-3.5' />
              </Button>
            )}
            {overridden && (
              <Button
                variant='ghost'
                size='icon'
                className='size-6'
                title={t('Clear')}
                aria-label={t('Clear')}
                onClick={() => clearLocaleValue(f.path)}
              >
                <Eraser className='size-3.5' />
              </Button>
            )}
          </div>
        </div>
        {f.type === 'textarea' ? (
          <Textarea
            rows={2}
            value={asText(own)}
            placeholder={fallback}
            onChange={(e) => setLocaleValue(f.path, e.target.value, f.type)}
          />
        ) : (
          <Input
            value={asText(own)}
            placeholder={fallback}
            onChange={(e) => setLocaleValue(f.path, e.target.value, f.type)}
          />
        )}
      </div>
    )
  }

  /* ---------------------------- 分区导航 ---------------------------- */

  const TABS: { key: string; title: string }[] = [
    { key: 'lang', title: 'Language and translation' },
    ...TEXT_GROUPS.map((g) => ({ key: g.key, title: g.title })),
    { key: 'shared', title: 'Shared assets (all languages)' },
  ]
  const activeGroup = TEXT_GROUPS.find((g) => g.key === tab)
  const groupFields = activeGroup
    ? activeGroup.fields.filter((f) => matches(f, activeGroup))
    : []
  const isSearching = query.length > 0

  /** 精选模型列表：默认值来自内置数据，后台覆盖写在 shared.models.items */
  const defaultModels = ((
    baseForLang as unknown as { models?: { items?: ModelItem[] } }
  ).models?.items ?? []) as ModelItem[]
  const sharedModelsRaw = getPath(draft.shared, 'models.items')
  const modelItems = (
    Array.isArray(sharedModelsRaw) ? sharedModelsRaw : defaultModels
  ) as ModelItem[]

  /** 03 灵感画廊作品：来源 + 手选列表，后台覆盖写在 shared.gallery.* */
  const defaultGallery = (baseForLang as unknown as {
    gallery?: {
      source?: GallerySource
      limit?: number
      items?: GalleryWork[]
    }
  }).gallery
  const sharedGallerySource = getPath(draft.shared, 'gallery.source')
  const sharedGalleryLimit = getPath(draft.shared, 'gallery.limit')
  const sharedGalleryItems = getPath(draft.shared, 'gallery.items')
  const gallerySource = (
    sharedGallerySource === 'manual' ||
    sharedGallerySource === 'latest' ||
    sharedGallerySource === 'popular'
      ? sharedGallerySource
      : (defaultGallery?.source ?? 'manual')
  ) as GallerySource
  const galleryLimit =
    typeof sharedGalleryLimit === 'number'
      ? sharedGalleryLimit
      : (defaultGallery?.limit ?? 10)
  const galleryItems = (
    Array.isArray(sharedGalleryItems)
      ? sharedGalleryItems
      : (defaultGallery?.items ?? [])
  ) as GalleryWork[]

  const filledInGroup = (group: FieldGroup) =>
    group.fields.filter((f) => {
      const v = getPath(localeDraft, f.path)
      return v !== undefined && v !== null && v !== ''
    }).length

  const TabButton = ({
    item,
    compact = false,
  }: {
    item: { key: string; title: string }
    compact?: boolean
  }) => {
    const active = item.key === tab && !isSearching
    return (
      <button
        type='button'
        onClick={() => {
          setTab(item.key)
          setSearch('')
        }}
        className={[
          compact
            ? 'shrink-0 rounded-full border px-3 py-1.5 text-xs transition'
            : 'flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm transition',
          active
            ? compact
              ? 'border-primary bg-primary text-primary-foreground'
              : 'bg-primary/10 font-medium text-primary'
            : 'text-muted-foreground hover:bg-muted',
          compact && !active ? 'border-border hover:bg-muted' : '',
        ].join(' ')}
      >
        <span>{t(item.title)}</span>
        {!compact && item.key === 'lang' && (
          <Badge variant='outline' className='tabular-nums'>
            {filledNow}/{TOTAL_TEXT_FIELDS}
          </Badge>
        )}
        {!compact && item.key !== 'lang' && (() => {
          const g = TEXT_GROUPS.find((x) => x.key === item.key)
          return g ? (
            <Badge variant='outline' className='tabular-nums'>
              {filledInGroup(g)}/{g.fields.length}
            </Badge>
          ) : null
        })()}
      </button>
    )
  }

  const languagePanel = (
    <>
      <Card>
        <CardHeader className='pb-3'>
          <CardTitle className='text-base'>{t('Language')}</CardTitle>
        </CardHeader>
        <CardContent className='space-y-3'>
          <div className='-mx-1 flex gap-2 overflow-x-auto px-1 pb-1'>
            {HOME_LOCALES.map((code) => {
              const filled = countFilled(code)
              const active = code === lang
              return (
                <Button
                  key={code}
                  variant={active ? 'default' : 'outline'}
                  size='sm'
                  className='shrink-0'
                  onClick={() => setLang(code)}
                >
                  {HOME_LOCALE_LABELS[code] ?? code}
                  <Badge
                    variant={active ? 'secondary' : 'outline'}
                    className='ml-1 tabular-nums'
                  >
                    {filled}/{TOTAL_TEXT_FIELDS}
                  </Badge>
                  {code === HOME_FALLBACK_LOCALE && (
                    <span className='ml-1 text-[10px] opacity-70'>fallback</span>
                  )}
                </Button>
              )
            })}
          </div>
          <div className='flex flex-wrap items-center gap-2'>
            <Button variant='outline' size='sm' onClick={fillEmptyFromFallback}>
              {t('Fill empty fields from fallback')}
            </Button>
            <Button variant='outline' size='sm' onClick={clearLanguage}>
              {t('Clear this language')}
            </Button>
            <AlertDialog>
              <AlertDialogTrigger
                render={
                  <Button variant='outline' size='sm'>
                    <RotateCcw className='size-4' /> {t('Reset all to defaults')}
                  </Button>
                }
              />
              <AlertDialogContent size='default'>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('Reset the whole homepage?')}</AlertDialogTitle>
                  <AlertDialogDescription>{t('Reset warning')}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t('Cancel')}</AlertDialogCancel>
                  <AlertDialogAction onClick={resetAll}>
                    {t('Confirm reset')}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
          <p className='text-xs text-muted-foreground'>
            {t('Filled for this language')}: {filledNow}/{TOTAL_TEXT_FIELDS}
          </p>
        </CardContent>
      </Card>

      <TranslateCard
        locales={draft.locales}
        currentLang={lang}
        writeField={writeField}
        markDirty={() => setDirty(true)}
      />
    </>
  )

  const sharedPanel = (
    <>
      {/* 视频轮播：醒目的独立面板，一眼看到「在这里添加视频」 */}
      <Card>
        <CardHeader className='pb-3'>
          <CardTitle className='text-base'>{t('Hero video playlist')}</CardTitle>
          <p className='text-xs text-muted-foreground'>
            {t('Video source for the homepage hero background; add as many clips as you need.')}
          </p>
        </CardHeader>
        <CardContent className='space-y-3'>
          <div className='space-y-2'>
            {videos.map((v, i) => (
              <div key={i} className='flex items-center gap-2'>
                <Badge variant='outline' className='w-12 justify-center'>
                  {String(i + 1).padStart(2, '0')}
                </Badge>
                <Input
                  value={v}
                  placeholder='/videos/xxx.mp4'
                  onChange={(e) =>
                    writeVideos(videos.map((old, j) => (j === i ? e.target.value : old)))
                  }
                />
                <Button
                  variant='ghost'
                  size='icon'
                  className='size-8'
                  aria-label={t('Move up')}
                  disabled={i === 0}
                  onClick={() => moveVideo(i, -1)}
                >
                  <ArrowUp className='size-4' />
                </Button>
                <Button
                  variant='ghost'
                  size='icon'
                  className='size-8'
                  aria-label={t('Move down')}
                  disabled={i === videos.length - 1}
                  onClick={() => moveVideo(i, 1)}
                >
                  <ArrowDown className='size-4' />
                </Button>
                <Button
                  variant='ghost'
                  size='icon'
                  className='size-8'
                  aria-label={t('Remove this clip')}
                  onClick={() => writeVideos(videos.filter((_, j) => j !== i))}
                >
                  <Trash2 className='size-4' />
                </Button>
              </div>
            ))}
            <Button
              variant='outline'
              size='sm'
              onClick={() => writeVideos([...videos, ''])}
            >
              <Plus className='size-4' /> {t('Add a clip')}
            </Button>
          </div>
          <p className='text-xs text-muted-foreground'>
            {t('Use a path under the site root (for example /videos/hero-video.mp4, stored in web/public/videos/). Clips loop in order; add as many as you need.')}
          </p>
        </CardContent>
      </Card>

      {SHARED_GROUPS.map((group) => {
        const fields = group.fields.filter((f) => matches(f, group))
        if (!fields.length) return null
        return (
          <Card key={group.key}>
            <CardHeader className='pb-3'>
              <CardTitle className='text-base'>{t(group.title)}</CardTitle>
            </CardHeader>
            <CardContent className='grid gap-3 md:grid-cols-2'>
              {fields.map((f) => (
                <div key={f.path}>
                  {renderField(f, asText(getPath(sharedResolved, f.path)))}
                </div>
              ))}
            </CardContent>
          </Card>
        )
      })}
    </>
  )

  const searchPanel = (
    <>
      {TEXT_GROUPS.map((group) => {
        const fields = group.fields.filter((f) => matches(f, group))
        if (!fields.length) return null
        return (
          <Card key={group.key}>
            <CardHeader className='pb-3'>
              <button
                type='button'
                className='text-left text-base font-semibold hover:underline'
                onClick={() => {
                  setTab(group.key)
                  setSearch('')
                }}
              >
                {t(group.title)}
              </button>
            </CardHeader>
            <CardContent className='grid gap-4 md:grid-cols-2'>
              {fields.map((f) => (
                <div key={f.path}>{renderTextField(f)}</div>
              ))}
            </CardContent>
          </Card>
        )
      })}
      {SHARED_GROUPS.map((group) => {
        const fields = group.fields.filter((f) => matches(f, group))
        if (!fields.length) return null
        return (
          <Card key={group.key}>
            <CardHeader className='pb-3'>
              <button
                type='button'
                className='text-left text-base font-semibold hover:underline'
                onClick={() => {
                  setTab('shared')
                  setSearch('')
                }}
              >
                {t(group.title)}
              </button>
            </CardHeader>
            <CardContent className='grid gap-3 md:grid-cols-2'>
              {fields.map((f) => (
                <div key={f.path}>
                  {renderField(f, asText(getPath(sharedResolved, f.path)))}
                </div>
              ))}
            </CardContent>
          </Card>
        )
      })}
      {!TEXT_GROUPS.some((g) => g.fields.some((f) => matches(f, g))) &&
        !SHARED_GROUPS.some((g) => g.fields.some((f) => matches(f, g))) && (
          <p className='rounded-md border border-dashed px-4 py-10 text-center text-sm text-muted-foreground'>
            {t('No fields match your search')}
          </p>
        )}
    </>
  )

  return (
    <div className='flex h-full w-full overflow-hidden'>
      {/* 左侧分区导航（桌面） */}
      <aside className='hidden w-60 shrink-0 flex-col border-r bg-muted/20 lg:flex'>
        <div className='border-b px-4 py-4'>
          <h1 className='text-base font-semibold'>{t('Home settings')}</h1>
          <p className='mt-1 text-[11px] leading-relaxed text-muted-foreground'>
            {t('Pick a section on the left, edit it on the right, then save.')}
          </p>
        </div>
        <nav className='flex-1 space-y-0.5 overflow-y-auto p-2'>
          {TABS.map((item) => (
            <TabButton key={item.key} item={item} />
          ))}
        </nav>
        <div className='border-t p-3 text-[11px] text-muted-foreground'>
          {t('Every language falls back to English, then to the built-in default.')}
        </div>
      </aside>

      <div className='flex min-w-0 flex-1 flex-col'>
        {/* 顶部工具条：搜索 + 保存 */}
        <div className='flex flex-wrap items-center gap-2 border-b bg-background/80 px-4 py-3 backdrop-blur'>
          <div className='relative w-full min-w-40 flex-1 sm:max-w-72'>
            <Search className='absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground' />
            <Input
              className='pl-8'
              value={search}
              placeholder={t('Search fields')}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {dirty && (
            <span className='text-xs text-amber-600 dark:text-amber-400'>
              {t('Unsaved changes')}
            </span>
          )}
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className='size-4 animate-spin' /> : <Save className='size-4' />}
            {t('Save')}
          </Button>
        </div>

        {/* 移动端：分区横滑 */}
        <div className='flex gap-2 overflow-x-auto border-b px-3 py-2 lg:hidden'>
          {TABS.map((item) => (
            <TabButton key={item.key} item={item} compact />
          ))}
        </div>

        <div className='flex-1 overflow-y-auto'>
          <div className='mx-auto w-full max-w-3xl space-y-5 p-4 pb-24'>
            {migrated && (
              <div className='rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs'>
                {t('Legacy config migrated to English')}
              </div>
            )}

            {isSearching ? (
              searchPanel
            ) : tab === 'lang' ? (
              languagePanel
            ) : tab === 'shared' ? (
              sharedPanel
            ) : activeGroup ? (
              <>
                <Card>
                  <CardHeader className='pb-3'>
                    <div className='flex flex-wrap items-center justify-between gap-2'>
                      <CardTitle className='text-base'>{t(activeGroup.title)}</CardTitle>
                      <Badge variant='outline' className='tabular-nums'>
                        {filledInGroup(activeGroup)}/{activeGroup.fields.length}
                      </Badge>
                    </div>
                    <p className='text-xs text-muted-foreground'>
                      {t('Editing language')}: {HOME_LOCALE_LABELS[lang] ?? lang}
                    </p>
                  </CardHeader>
                  <CardContent className='grid gap-4 md:grid-cols-2'>
                    {groupFields.map((f) => (
                      <div key={f.path}>{renderTextField(f)}</div>
                    ))}
                  </CardContent>
                </Card>

                {activeGroup.key === 'models' && (
                  <ModelItemsCard
                    items={modelItems}
                    overridden={Array.isArray(sharedModelsRaw)}
                    onChange={(items) => setSharedValue('models.items', items)}
                    onReset={() => setSharedValue('models.items', '')}
                  />
                )}

                {activeGroup.key === 'gallery' && (
                  <GalleryItemsCard
                    source={gallerySource}
                    limit={galleryLimit}
                    items={galleryItems}
                    itemsOverridden={Array.isArray(sharedGalleryItems)}
                    sourceOverridden={
                      sharedGallerySource !== undefined && sharedGallerySource !== ''
                    }
                    onSourceChange={(v) => setSharedValue('gallery.source', v)}
                    onLimitChange={(v) => setSharedValue('gallery.limit', v)}
                    onChange={(items) => setSharedValue('gallery.items', items)}
                    onResetItems={() => setSharedValue('gallery.items', '')}
                    onResetSource={() => {
                      setSharedValue('gallery.source', '')
                      setSharedValue('gallery.limit', '')
                    }}
                  />
                )}
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

export default HomeSettings
