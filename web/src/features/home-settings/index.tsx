/**
 * 首页设置（二开设置 → 首页设置）
 * ------------------------------------------------------------------
 * 编辑画廊首页的全部可配置内容：首屏视频轮播（任意个数、按序循环）
 * + 各区块文字。存储为 HomeConfig option（JSON），公开接口
 * GET /api/home_config 供画廊首页读取；未配置时前端走内置默认值。
 */
import { useEffect, useState } from 'react'
import { Loader2, Plus, Save, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  getSystemOptions,
  updateSystemOption,
} from '@/features/system-settings/api'
import { buildHomeData, buildMotionData, mergeHomeConfig } from '@/features/gallery-home/data'
import { homeConfigSchema } from '@/features/gallery-home/schema'

type Config = Record<string, unknown>

/** 按路径取值（支持 a.b.0.c 数组下标） */
function getPath(obj: unknown, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>(
      (acc, k) =>
        acc && typeof acc === 'object' ? (acc as Config)[k] : undefined,
      obj
    )
}

/** 按路径写值（不可变克隆） */
function setPath(obj: Config, path: string, value: unknown): Config {
  const keys = path.split('.')
  const clone = (node: unknown, i: number): unknown => {
    if (i === keys.length) return value
    const key = keys[i]
    const next = node && typeof node === 'object' ? (node as Config) : {}
    const child = clone(next[key], i + 1)
    return { ...next, [key]: child } as Config
  }
  return clone(obj, 0) as Config
}

import { FIELD_GROUPS, type Field } from './field-groups'

const HOME_CONFIG_KEY = 'HomeConfig'

export function HomeSettings() {
  const { t } = useTranslation()
  const [cfg, setCfg] = useState<Config | null>(null)
  const [videos, setVideos] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const res = await getSystemOptions()
        const raw = res?.data?.find((o) => o.key === HOME_CONFIG_KEY)?.value
        const overrides =
          typeof raw === 'string' && raw.trim() !== '' ? JSON.parse(raw) : {}
        // 默认文案按当前界面语言显示（编辑框里的 placeholder 就是当前语言默认值）
        const base = buildHomeData(t) as unknown as Config
        const merged = mergeHomeConfig(base, overrides) as Config
        const motionDefault = buildMotionData(t).heroVideo.videos
        const motion = (overrides as { motion?: { heroVideo?: { videos?: unknown } } })
          .motion
        const list = Array.isArray(motion?.heroVideo?.videos)
          ? (motion!.heroVideo!.videos as unknown[]).filter(
              (v): v is string => typeof v === 'string' && v.trim() !== ''
            )
          : motionDefault
        if (!alive) return
        setCfg(merged)
        setVideos(list)
      } catch {
        if (!alive) return
        setCfg(buildHomeData(t) as unknown as Config)
        setVideos(buildMotionData(t).heroVideo.videos)
        toast.error(t('Failed to load home settings, fell back to defaults'))
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [t])

  const update = (path: string, value: string, type?: Field['type']) => {
    setCfg((prev) => {
      if (!prev) return prev
      if (type === 'list') {
        return setPath(prev, path, value.split(/[,，]/).map((s) => s.trim()).filter(Boolean))
      }
      return setPath(prev, path, value)
    })
  }

  const save = async () => {
    if (!cfg) return
    setSaving(true)
    try {
      const payload = {
        ...cfg,
        motion: {
          heroVideo: {
            enabled: true,
            videos: videos.filter((v) => v.trim() !== ''),
          },
        },
      }
      // 保存前校验：结构不合规直接拦下，避免脏配置把前台首页打挂
      const parsed = homeConfigSchema.safeParse(payload)
      if (!parsed.success) {
        const first = parsed.error.issues[0]
        toast.error(`${t('Home settings validation failed')}: ${first?.path?.join('.') || ''} ${first?.message || ''}`)
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
      toast.success(t('Home settings saved, refresh the homepage to see it'))
    } catch {
      toast.error(t('Save failed, please retry later'))
    } finally {
      setSaving(false)
    }
  }

  if (loading || !cfg) {
    return (
      <div className='flex items-center justify-center gap-2 py-24 text-muted-foreground'>
        <Loader2 className='size-4 animate-spin' /> {t('Loading…')}
      </div>
    )
  }

  return (
    <div className='mx-auto w-full max-w-4xl space-y-5 p-4 pb-16'>
      <div className='flex items-center justify-between gap-3'>
        <div>
          <h1 className='text-xl font-semibold'>{t('Home settings')}</h1>
          <p className='text-sm text-muted-foreground'>
            {t('The hero playlist accepts any number of clips played in order; text changes show up after refreshing the homepage.')}
          </p>
        </div>
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className='size-4 animate-spin' /> : <Save className='size-4' />}
          {t('Save')}
        </Button>
      </div>

      {/* 视频轮播 */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2 text-base'>
            {t('Hero video playlist')}
            <Badge variant='secondary'>{videos.length} {t('clips')}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className='space-y-3'>
          {videos.map((v, i) => (
            <div key={i} className='flex items-center gap-2'>
              <Badge variant='outline' className='w-12 justify-center'>
                {String(i + 1).padStart(2, '0')}
              </Badge>
              <Input
                value={v}
                placeholder='/videos/xxx.mp4'
                onChange={(e) =>
                  setVideos((prev) =>
                    prev.map((old, j) => (j === i ? e.target.value : old))
                  )
                }
              />
              <Button
                variant='ghost'
                size='icon'
                aria-label={t('Remove this clip')}
                onClick={() => setVideos((prev) => prev.filter((_, j) => j !== i))}
              >
                <Trash2 className='size-4' />
              </Button>
            </div>
          ))}
          <Button
            variant='outline'
            size='sm'
            onClick={() => setVideos((prev) => [...prev, ''])}
          >
            <Plus className='size-4' /> {t('Add a clip')}
          </Button>
          <p className='text-xs text-muted-foreground'>
            {t('Use a path under the site root (for example /videos/hero-video.mp4, stored in web/public/videos/). Clips loop in order; add as many as you need.')}
          </p>
        </CardContent>
      </Card>

      {/* 文字分组 */}
      {FIELD_GROUPS.map((group) => (
        <Card key={group.key}>
          <CardHeader>
            <CardTitle className='text-base'>{t(group.title)}</CardTitle>
          </CardHeader>
          <CardContent className='grid gap-4 md:grid-cols-2'>
            {group.fields.map((f) => (
              <div
                key={f.path}
                className={f.type === 'textarea' ? 'md:col-span-2' : ''}
              >
                <Label className='mb-1.5 block text-xs'>{t(f.label)}</Label>
                {f.type === 'textarea' ? (
                  <Textarea
                    rows={2}
                    value={String(getPath(cfg, f.path) ?? '')}
                    onChange={(e) => update(f.path, e.target.value)}
                  />
                ) : (
                  <Input
                    value={
                      f.type === 'list'
                        ? ((getPath(cfg, f.path) as string[]) ?? []).join('，')
                        : String(getPath(cfg, f.path) ?? '')
                    }
                    onChange={(e) => update(f.path, e.target.value, f.type)}
                  />
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      <div className='flex justify-end'>
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className='size-4 animate-spin' /> : <Save className='size-4' />}
          {t('Save')}
        </Button>
      </div>
    </div>
  )
}

export default HomeSettings
