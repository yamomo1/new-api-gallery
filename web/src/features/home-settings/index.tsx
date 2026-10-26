/**
 * 首页设置（二开设置 → 首页设置）
 * ------------------------------------------------------------------
 * 编辑画廊首页的全部可配置内容：首屏视频轮播（任意个数、按序循环）
 * + 各区块文字。存储为 HomeConfig option（JSON），公开接口
 * GET /api/home_config 供画廊首页读取；未配置时前端走内置默认值。
 */
import { useEffect, useState } from 'react'
import { Loader2, Plus, Save, Trash2 } from 'lucide-react'
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
import { mergeHomeConfig } from '@/features/gallery-home/data'
import { HOME_DATA, MOTION_DATA } from '@/features/gallery-home/data'

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

type Field = { path: string; label: string; type?: 'text' | 'textarea' | 'list' }

const FIELD_GROUPS: { key: string; title: string; fields: Field[] }[] = [
  {
    key: 'hero',
    title: '首屏 Hero',
    fields: [
      { path: 'hero.badge', label: '徽标文字' },
      { path: 'hero.announcement', label: '公告条' },
      { path: 'hero.title', label: '主标题（\n 换行）', type: 'textarea' },
      { path: 'hero.titleAccent', label: '标题金色强调句' },
      { path: 'hero.subtitle', label: '副标题', type: 'textarea' },
      { path: 'hero.primaryLabel', label: '主按钮文字' },
      { path: 'hero.primaryUrl', label: '主按钮链接' },
      { path: 'hero.secondaryLabel', label: '次按钮文字' },
      { path: 'hero.secondaryUrl', label: '次按钮链接（留空隐藏）' },
      { path: 'hero.metaLabels', label: '✓ 特性短语（逗号分隔）', type: 'list' },
    ],
  },
  {
    key: 'agent',
    title: 'Canvas Agent 区块',
    fields: [
      { path: 'agent.titleLine1', label: '标题第一行' },
      { path: 'agent.titleLine2', label: '标题第二行（灰色）' },
      { path: 'agent.lead', label: '右侧说明', type: 'textarea' },
      { path: 'agent.placeholder', label: '输入框占位文字', type: 'textarea' },
      { path: 'agent.autoLabel', label: '下拉「自动」项文字' },
      { path: 'agent.skillsMenuTitle', label: '下拉菜单标题' },
      { path: 'agent.helperLabel', label: '确认提示语' },
      { path: 'agent.skills.0.label', label: '技能 1 名称' },
      { path: 'agent.skills.1.label', label: '技能 2 名称' },
      { path: 'agent.skills.2.label', label: '技能 3 名称' },
      { path: 'agent.skills.3.label', label: '技能 4 名称' },
      { path: 'agent.skills.4.label', label: '技能 5 名称' },
      { path: 'agent.skills.5.label', label: '技能 6 名称' },
    ],
  },
  {
    key: 'studios',
    title: '工作室区块',
    fields: [
      { path: 'studios.title', label: '标题' },
      { path: 'studios.lead', label: '说明', type: 'textarea' },
    ],
  },
  {
    key: 'gallery',
    title: '灵感画廊区块',
    fields: [
      { path: 'gallery.title', label: '标题' },
      { path: 'gallery.lead', label: '说明', type: 'textarea' },
      { path: 'gallery.exploreLabel', label: '浏览按钮文字' },
    ],
  },
  {
    key: 'models',
    title: '模型亮点区块',
    fields: [
      { path: 'models.title', label: '标题' },
      { path: 'models.lead', label: '说明', type: 'textarea' },
      { path: 'models.exploreLabel', label: '浏览按钮文字' },
    ],
  },
  {
    key: 'cta',
    title: 'API 区块',
    fields: [
      { path: 'cta.title', label: '标题' },
      { path: 'cta.lead', label: '说明', type: 'textarea' },
      { path: 'cta.connectLabel', label: '按钮文字' },
    ],
  },
  {
    key: 'closing',
    title: '落幕 CTA 区块',
    fields: [
      { path: 'closing.title', label: '标题' },
      { path: 'closing.lead', label: '说明', type: 'textarea' },
      { path: 'closing.primaryLabel', label: '主按钮文字' },
      { path: 'closing.primaryUrl', label: '主按钮链接' },
      { path: 'closing.secondaryLabel', label: '次按钮文字' },
      { path: 'closing.secondaryUrl', label: '次按钮链接' },
    ],
  },
]

const HOME_CONFIG_KEY = 'HomeConfig'

export function HomeSettings() {
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
        const merged = mergeHomeConfig(HOME_DATA, overrides) as Config
        const motion = (overrides as { motion?: { heroVideo?: { videos?: unknown } } })
          .motion
        const list = Array.isArray(motion?.heroVideo?.videos)
          ? (motion!.heroVideo!.videos as unknown[]).filter(
              (v): v is string => typeof v === 'string' && v.trim() !== ''
            )
          : MOTION_DATA.heroVideo.videos
        if (!alive) return
        setCfg(merged)
        setVideos(list)
      } catch {
        if (!alive) return
        setCfg(HOME_DATA as unknown as Config)
        setVideos(MOTION_DATA.heroVideo.videos)
        toast.error('加载首页配置失败，已回退默认值')
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [])

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
      const config = {
        ...cfg,
        motion: {
          heroVideo: {
            enabled: true,
            videos: videos.filter((v) => v.trim() !== ''),
          },
        },
      }
      const res = await updateSystemOption({
        key: HOME_CONFIG_KEY,
        value: JSON.stringify(config),
      })
      if (res?.success === false) {
        toast.error(res.message || '保存失败')
        return
      }
      toast.success('首页配置已保存，刷新首页即可看到效果')
    } catch {
      toast.error('保存失败，请稍后重试')
    } finally {
      setSaving(false)
    }
  }

  if (loading || !cfg) {
    return (
      <div className='flex items-center justify-center gap-2 py-24 text-muted-foreground'>
        <Loader2 className='size-4 animate-spin' /> 加载中…
      </div>
    )
  }

  return (
    <div className='mx-auto w-full max-w-4xl space-y-5 p-4 pb-16'>
      <div className='flex items-center justify-between gap-3'>
        <div>
          <h1 className='text-xl font-semibold'>首页设置</h1>
          <p className='text-sm text-muted-foreground'>
            视频轮播支持任意个数、按顺序循环播放；文字改动保存后前台刷新即生效。
          </p>
        </div>
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className='size-4 animate-spin' /> : <Save className='size-4' />}
          保存
        </Button>
      </div>

      {/* 视频轮播 */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2 text-base'>
            首屏视频轮播
            <Badge variant='secondary'>{videos.length} 段</Badge>
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
                aria-label='删除该段'
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
            <Plus className='size-4' /> 添加一段视频
          </Button>
          <p className='text-xs text-muted-foreground'>
            填网站根路径下的视频地址（如 /videos/hero-video.mp4，文件放
            web/public/videos/）。按顺序循环播放，可添加任意个数。
          </p>
        </CardContent>
      </Card>

      {/* 文字分组 */}
      {FIELD_GROUPS.map((group) => (
        <Card key={group.key}>
          <CardHeader>
            <CardTitle className='text-base'>{group.title}</CardTitle>
          </CardHeader>
          <CardContent className='grid gap-4 md:grid-cols-2'>
            {group.fields.map((f) => (
              <div
                key={f.path}
                className={f.type === 'textarea' ? 'md:col-span-2' : ''}
              >
                <Label className='mb-1.5 block text-xs'>{f.label}</Label>
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
          保存
        </Button>
      </div>
    </div>
  )
}

export default HomeSettings
