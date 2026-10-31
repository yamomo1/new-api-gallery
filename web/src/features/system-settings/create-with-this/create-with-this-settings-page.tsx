/**
 * 去创作设置（后台 Fork settings → 去创作设置）
 * ------------------------------------------------------------------
 * 四个入口各一个开关，关掉即刻从前台详情页消失，无需发版：
 *  1. 网盘手动下载    —— 作品里配置了网盘分享链接时显示
 *  2. ComfyUI 一键生图 —— 需客户本地装 ymm-bridge 节点
 *  3. RunningHub 云端 —— 跳转云端工作流体验页
 *  4. 手动工作流 JSON —— 下载后拖进本地 ComfyUI（零安装）
 *
 * 保存后由 /api/status 的 gallery_create_config 下发，前端实时读取。
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Loader2, Save, Settings2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { api } from '@/lib/api'

type CreateConfig = {
  netdisk_download: boolean
  comfyui_node: boolean
  runninghub: boolean
  manual_workflow: boolean
}

const DEFAULTS: CreateConfig = {
  netdisk_download: true,
  comfyui_node: true,
  runninghub: true,
  manual_workflow: true,
}

export function CreateWithThisSettingsPage() {
  const { t } = useTranslation()
  const [config, setConfig] = useState<CreateConfig>(DEFAULTS)
  const [initial, setInitial] = useState<CreateConfig>(DEFAULTS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const resp = await api.get(
        '/api/prompt-gallery/v1/gallery-create-config'
      )
      const data = (resp.data?.data ?? DEFAULTS) as CreateConfig
      const normalized: CreateConfig = { ...DEFAULTS, ...data }
      setConfig(normalized)
      setInitial(normalized)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const dirty = useMemo(
    () => JSON.stringify(config) !== JSON.stringify(initial),
    [config, initial]
  )

  const set = <K extends keyof CreateConfig>(key: K, value: CreateConfig[K]) =>
    setConfig((c) => ({ ...c, [key]: value }))

  async function save() {
    setSaving(true)
    try {
      const resp = await api.put(
        '/api/prompt-gallery/v1/gallery-create-config',
        config
      )
      if (resp.data?.success === false) {
        throw new Error(resp.data?.message || '保存失败')
      }
      const data = (resp.data?.data ?? config) as CreateConfig
      setConfig((c) => ({ ...c, ...data }))
      setInitial((c) => ({ ...c, ...data }))
      toast.success(t('Settings saved'))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className='flex items-center gap-2 py-10 text-sm text-muted-foreground'>
        <Loader2 className='size-4 animate-spin' />
        {t('Loading…')}
      </div>
    )
  }

  const rows: {
    key: keyof CreateConfig
    title: string
    desc: string
  }[] = [
    {
      key: 'netdisk_download',
      title: t('Netdisk manual download', { defaultValue: '网盘手动下载' }),
      desc: t(
        'Show netdisk share links (e.g. Quark) of the models. Customers download manually.',
        { defaultValue: '展示模型在网盘（如夸克）的分享链接，客户自行下载，不做自动拉取。' }
      ),
    },
    {
      key: 'comfyui_node',
      title: t('ComfyUI one-click', { defaultValue: 'ComfyUI 一键生图' }),
      desc: t(
        'Open local ComfyUI with the ymm-bridge node, which downloads missing models and loads the workflow automatically.',
        {
          defaultValue:
            '唤起本地 ComfyUI（ymm-bridge 节点）自动下载缺失模型并加载工作流；需客户先安装该节点。',
        }
      ),
    },
    {
      key: 'runninghub',
      title: t('RunningHub cloud', { defaultValue: 'RunningHub 云端出图' }),
      desc: t(
        'Jump to the RunningHub cloud workflow page. No local installation needed.',
        { defaultValue: '跳转 RunningHub 云端 ComfyUI 工作流体验页，无需本地安装。' }
      ),
    },
    {
      key: 'manual_workflow',
      title: t('Manual workflow JSON', { defaultValue: '手动工作流 JSON' }),
      desc: t(
        'Download the ComfyUI workflow JSON and drag it into local ComfyUI. Zero install.',
        { defaultValue: '下载 ComfyUI 工作流 JSON，客户拖进本地 ComfyUI 使用，零安装。' }
      ),
    },
  ]

  return (
    <div className='mx-auto max-w-3xl space-y-6 py-6'>
      <div className='flex items-start justify-between gap-4'>
        <div className='space-y-1'>
          <h1 className='flex items-center gap-2 text-2xl font-semibold'>
            <Settings2 className='size-5' />
            {t('Create with this', { defaultValue: '去创作设置' })}
          </h1>
          <p className='text-sm text-muted-foreground'>
            {t(
              'Choose which entries appear on the gallery detail page. Disabled entries disappear immediately.',
              {
                defaultValue:
                  '选择详情页「去创作」展示哪些入口。关闭的入口会立刻从前台消失，无需发版。',
              }
            )}
          </p>
        </div>
        <Button onClick={save} disabled={!dirty || saving}>
          {saving ? (
            <Loader2 className='size-4 animate-spin' />
          ) : (
            <Save className='size-4' />
          )}
          {t('Save')}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('Entries', { defaultValue: '功能入口' })}</CardTitle>
          <CardDescription>
            {t(
              'An entry only shows when the toggle is on AND the work has the required data (workflow JSON / RunningHub ID / netdisk links).',
              {
                defaultValue:
                  '入口需同时满足两个条件才显示：开关打开 + 该作品配了对应数据（工作流 JSON / RunningHub ID / 网盘链接）。',
              }
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-5'>
          {rows.map((row) => (
            <div key={row.key} className='flex items-start justify-between gap-4'>
              <div className='space-y-1'>
                <Label>{row.title}</Label>
                <p className='text-xs text-muted-foreground'>{row.desc}</p>
              </div>
              <Switch
                checked={config[row.key]}
                onCheckedChange={(v) => set(row.key, v)}
              />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
