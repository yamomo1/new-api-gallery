import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  Fingerprint,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  Save,
  ScanEye,
  ShieldCheck,
  Video,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'

import {
  getOptionValue,
  useSystemOptions,
} from '@/features/system-settings/hooks/use-system-options'
import { useUpdateOption } from '@/features/system-settings/hooks/use-update-option'
import { api } from '@/lib/api'

const WATERMARK_KEYS = [
  'WatermarkEnabled',
  'WatermarkExplicit',
  'WatermarkImplicit',
  'WatermarkText',
  'WatermarkPosition',
  'WatermarkOpacity',
  'WatermarkFontScale',
  'WatermarkColor',
  'WatermarkBgEnabled',
  'WatermarkFontPath',
  'WatermarkProviderName',
  'WatermarkDeclareText',
  'WatermarkFFmpegPath',
  'WatermarkVideoMaxSeconds',
  'WatermarkVideoMaxMB',
] as const

type WatermarkKey = (typeof WATERMARK_KEYS)[number]
type WatermarkMap = Record<WatermarkKey, string>

const DEFAULTS: WatermarkMap = {
  WatermarkEnabled: 'true',
  WatermarkExplicit: 'true',
  WatermarkImplicit: 'true',
  WatermarkText: 'AI 生成',
  WatermarkPosition: 'bottom-right',
  WatermarkOpacity: '78',
  WatermarkFontScale: '26',
  WatermarkColor: '#FFFFFF',
  WatermarkBgEnabled: 'true',
  WatermarkFontPath: '',
  WatermarkProviderName: '',
  WatermarkDeclareText: '本内容由人工智能生成合成',
  WatermarkFFmpegPath: '',
  WatermarkVideoMaxSeconds: '60',
  WatermarkVideoMaxMB: '50',
}

const POSITIONS = [
  { value: 'bottom-right', label: '右下角' },
  { value: 'bottom-left', label: '左下角' },
  { value: 'top-right', label: '右上角' },
  { value: 'top-left', label: '左上角' },
  { value: 'center', label: '居中' },
] as const

type WatermarkStatus = {
  ffmpeg_ready: boolean
  ffmpeg_bin: string
  font_source: string
  font_cjk_ready: boolean
  notes: string[]
}

type BackfillState = {
  running: boolean
  dry_run: boolean
  total: number
  processed: number
  updated: number
  skipped: number
  failed: number
  message: string
}

export function WatermarkSettingsPage() {
  const { t } = useTranslation()
  const { data: optionsResp, isLoading } = useSystemOptions()
  const options = optionsResp?.data
  const updateOption = useUpdateOption()

  const [form, setForm] = useState<WatermarkMap>(DEFAULTS)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<WatermarkStatus | null>(null)
  const [backfill, setBackfill] = useState<BackfillState | null>(null)
  const [backfillBusy, setBackfillBusy] = useState(false)

  const initial = useMemo(
    () => getOptionValue(options, DEFAULTS as WatermarkMap),
    [options],
  )

  useEffect(() => {
    if (options) setForm(getOptionValue(options, DEFAULTS as WatermarkMap))
  }, [options])

  const loadStatus = useCallback(async () => {
    try {
      const resp = await api.get('/api/watermark/status')
      setStatus(resp.data?.data ?? null)
    } catch {
      /* 状态取不到不影响设置本身 */
    }
  }, [])

  const loadBackfill = useCallback(async () => {
    try {
      const resp = await api.get('/api/watermark/backfill/status')
      setBackfill(resp.data?.data ?? null)
    } catch {
      /* 忽略 */
    }
  }, [])

  useEffect(() => {
    void loadStatus()
    void loadBackfill()
  }, [loadStatus, loadBackfill])

  // 补打任务运行中时每 2 秒刷新一次进度
  useEffect(() => {
    if (!backfill?.running) return
    const timer = setInterval(() => void loadBackfill(), 2000)
    return () => clearInterval(timer)
  }, [backfill?.running, loadBackfill])

  const set = (k: WatermarkKey, v: string) =>
    setForm((f) => ({ ...f, [k]: v }))

  async function save() {
    setSaving(true)
    try {
      for (const k of WATERMARK_KEYS) {
        if (form[k] !== initial[k]) {
          await updateOption.mutateAsync({ key: k, value: form[k] })
        }
      }
      toast.success(t('Settings saved'))
      void loadStatus()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  async function runBackfill(dryRun: boolean) {
    setBackfillBusy(true)
    try {
      await api.post('/api/watermark/backfill', { limit: 50, dry_run: dryRun })
      toast.success(dryRun ? '已开始试运行（不写入）' : '已开始补打')
      void loadBackfill()
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? String(e))
    } finally {
      setBackfillBusy(false)
    }
  }

  if (isLoading) {
    return (
      <div className='flex justify-center p-16'>
        <Loader2 className='size-6 animate-spin text-muted-foreground' />
      </div>
    )
  }

  const enabled = form.WatermarkEnabled === 'true'
  const explicitOn = form.WatermarkExplicit === 'true'
  const implicitOn = form.WatermarkImplicit === 'true'

  return (
    <div className='mx-auto max-w-4xl space-y-6 p-6'>
      <div>
        <h2 className='flex items-center gap-2 text-lg font-semibold'>
          <ShieldCheck className='size-5' />
          内容标识与版权保护
        </h2>
        <p className='mt-1 text-sm text-muted-foreground'>
          依据《人工智能生成合成内容标识办法》（2025-09-01 施行），对全站展示的图片与视频
          同时施加<strong className='text-foreground'>显式标识</strong>（画面角标）与
          <strong className='text-foreground'>隐式标识</strong>（文件元数据）。
          用户上传的素材同样处理——对外可见的每一份文件都带标识。
        </p>
      </div>

      {/* 总开关 + 实时预览 */}
      <Card>
        <CardHeader className='pb-3'>
          <CardTitle className='flex items-center justify-between text-base'>
            <span>总开关</span>
            <Switch
              checked={enabled}
              onCheckedChange={(v) => set('WatermarkEnabled', v === true ? 'true' : 'false')}
            />
          </CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          <BadgePreview form={form} />
          <p className='text-xs text-muted-foreground'>
            预览用于确认位置与大小比例；实际渲染由服务端按原图分辨率计算，
            角标字号 = 图片短边 ÷ {form.WatermarkFontScale || '26'}。
          </p>
        </CardContent>
      </Card>

      {/* 显式标识 */}
      <Card>
        <CardHeader className='pb-3'>
          <CardTitle className='flex items-center justify-between text-base'>
            <span className='flex items-center gap-2'>
              <ScanEye className='size-4' />
              显式标识（画面角标）
            </span>
            <Switch
              checked={explicitOn}
              disabled={!enabled}
              onCheckedChange={(v) =>
                set('WatermarkExplicit', v === true ? 'true' : 'false')
              }
            />
          </CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          <Row label='角标文案'>
            <Input
              value={form.WatermarkText}
              onChange={(e) => set('WatermarkText', e.target.value)}
              placeholder='AI 生成'
              disabled={!enabled || !explicitOn}
            />
          </Row>
          <Row label='位置'>
            <Select
              value={form.WatermarkPosition}
              onValueChange={(v) => set('WatermarkPosition', v ?? 'bottom-right')}
              disabled={!enabled || !explicitOn}
            >
              <SelectTrigger className='w-[220px]'>
                <SelectValue>
                  {POSITIONS.find((p) => p.value === form.WatermarkPosition)?.label ??
                    form.WatermarkPosition}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {POSITIONS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Row>
          <Row
            label='字号密度'
            hint='数值越小角标越大。26 表示字号 = 图片短边的 1/26'
          >
            <Input
              type='number'
              min={8}
              max={200}
              value={form.WatermarkFontScale}
              onChange={(e) => set('WatermarkFontScale', e.target.value)}
              className='w-[140px]'
              disabled={!enabled || !explicitOn}
            />
          </Row>
          <Row label='不透明度'>
            <Input
              type='number'
              min={10}
              max={100}
              value={form.WatermarkOpacity}
              onChange={(e) => set('WatermarkOpacity', e.target.value)}
              className='w-[140px]'
              disabled={!enabled || !explicitOn}
            />
          </Row>
          <Row label='文字颜色'>
            <div className='flex items-center gap-2'>
              <input
                type='color'
                value={form.WatermarkColor}
                onChange={(e) => set('WatermarkColor', e.target.value)}
                className='size-9 cursor-pointer rounded-md border border-border bg-transparent'
                disabled={!enabled || !explicitOn}
              />
              <Input
                value={form.WatermarkColor}
                onChange={(e) => set('WatermarkColor', e.target.value)}
                className='w-[140px] font-mono text-xs'
                disabled={!enabled || !explicitOn}
              />
            </div>
          </Row>
          <Row label='半透明底衬' hint='任何画面上都能保证可读，建议开启'>
            <Switch
              checked={form.WatermarkBgEnabled === 'true'}
              disabled={!enabled || !explicitOn}
              onCheckedChange={(v) =>
                set('WatermarkBgEnabled', v === true ? 'true' : 'false')
              }
            />
          </Row>
          <Row
            label='字体文件'
            hint='留空自动探测系统中文字体；探测不到会降级为拉丁文案'
          >
            <Input
              value={form.WatermarkFontPath}
              onChange={(e) => set('WatermarkFontPath', e.target.value)}
              placeholder='/usr/share/fonts/truetype/wqy/wqy-microhei.ttc'
              disabled={!enabled || !explicitOn}
            />
          </Row>
          {status && (
            <div className='flex flex-wrap items-center gap-2 rounded-lg bg-muted/50 p-3 text-xs'>
              <span className='text-muted-foreground'>当前字体：</span>
              <code className='font-mono'>{status.font_source || '未知'}</code>
              <Badge variant={status.font_cjk_ready ? 'secondary' : 'destructive'}>
                {status.font_cjk_ready ? '支持中文' : '仅拉丁字符'}
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 隐式标识 */}
      <Card>
        <CardHeader className='pb-3'>
          <CardTitle className='flex items-center justify-between text-base'>
            <span className='flex items-center gap-2'>
              <Fingerprint className='size-4' />
              隐式标识（文件元数据）
            </span>
            <Switch
              checked={implicitOn}
              disabled={!enabled}
              onCheckedChange={(v) =>
                set('WatermarkImplicit', v === true ? 'true' : 'false')
              }
            />
          </CardTitle>
          <p className='mt-1 text-sm text-muted-foreground'>
            写入生成合成内容属性、服务提供者名称与内容编号。第三方检测工具可读，
            不影响画质与体积。
          </p>
        </CardHeader>
        <CardContent className='space-y-4'>
          <Row label='声明语'>
            <Input
              value={form.WatermarkDeclareText}
              onChange={(e) => set('WatermarkDeclareText', e.target.value)}
              placeholder='本内容由人工智能生成合成'
              disabled={!enabled || !implicitOn}
            />
          </Row>
          <Row label='服务提供者' hint='留空则使用站点名称'>
            <Input
              value={form.WatermarkProviderName}
              onChange={(e) => set('WatermarkProviderName', e.target.value)}
              placeholder='留空则取系统名称'
              disabled={!enabled || !implicitOn}
            />
          </Row>
          <div className='space-y-1 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground'>
            {(status?.notes ?? [
              'PNG：写入 iTXt/tEXt（UTF-8，支持中文）',
              'JPEG：写入 EXIF + XMP（IPTC DigitalSourceType 标准取值）',
              'MP4：moov 在尾部时写 udta，否则在文件末尾追加 XMP 扩展盒',
            ]).map((n) => (
              <div key={n}>· {n}</div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 视频 */}
      <Card>
        <CardHeader className='pb-3'>
          <CardTitle className='flex items-center gap-2 text-base'>
            <Video className='size-4' />
            视频处理
          </CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='flex items-center gap-2 rounded-lg bg-muted/50 p-3 text-xs'>
            <span className='text-muted-foreground'>ffmpeg：</span>
            <Badge variant={status?.ffmpeg_ready ? 'secondary' : 'destructive'}>
              {status?.ffmpeg_ready ? '已就绪' : '未安装'}
            </Badge>
            <code className='font-mono text-muted-foreground'>
              {status?.ffmpeg_bin || '—'}
            </code>
          </div>
          {!status?.ffmpeg_ready && (
            <p className='text-xs text-amber-600 dark:text-amber-500'>
              未安装 ffmpeg 时，视频无法把角标烧进画面，只会写入隐式元数据。
              服务器镜像已内置 ffmpeg，本地开发环境需自行安装。
            </p>
          )}
          <Row label='ffmpeg 路径' hint='留空自动探测 PATH 与常见安装目录'>
            <Input
              value={form.WatermarkFFmpegPath}
              onChange={(e) => set('WatermarkFFmpegPath', e.target.value)}
              placeholder='/usr/bin/ffmpeg'
            />
          </Row>
          <Row label='烧角标最长时长' hint='超出则不烧角标（仍写元数据），防止 CPU 转码拖垮服务'>
            <div className='flex items-center gap-2'>
              <Input
                type='number'
                min={0}
                value={form.WatermarkVideoMaxSeconds}
                onChange={(e) => set('WatermarkVideoMaxSeconds', e.target.value)}
                className='w-[140px]'
              />
              <span className='text-sm text-muted-foreground'>秒</span>
            </div>
          </Row>
          <Row label='烧角标最大体积'>
            <div className='flex items-center gap-2'>
              <Input
                type='number'
                min={0}
                value={form.WatermarkVideoMaxMB}
                onChange={(e) => set('WatermarkVideoMaxMB', e.target.value)}
                className='w-[140px]'
              />
              <span className='text-sm text-muted-foreground'>MB</span>
            </div>
          </Row>
        </CardContent>
      </Card>

      {/* 存量补打 */}
      <Card>
        <CardHeader className='pb-3'>
          <CardTitle className='flex items-center gap-2 text-base'>
            <RefreshCw className='size-4' />
            存量文件补打
          </CardTitle>
          <p className='mt-1 text-sm text-muted-foreground'>
            给已经上传、还没有标识的文件补上。只处理我们自己存储里的文件（外链自动跳过），
            已带标识的文件不会重复叠加。每次先跑「试运行」看清影响面。
          </p>
        </CardHeader>
        <CardContent className='space-y-3'>
          <div className='flex flex-wrap gap-2'>
            <Button
              variant='outline'
              onClick={() => runBackfill(true)}
              disabled={backfillBusy || backfill?.running}
            >
              试运行（不写入）
            </Button>
            <Button
              onClick={() => runBackfill(false)}
              disabled={backfillBusy || backfill?.running}
            >
              开始补打（本次 50 条）
            </Button>
          </div>
          {backfill && (backfill.total > 0 || backfill.running) && (
            <div className='space-y-2 rounded-lg border border-border p-3 text-xs'>
              <div className='flex items-center gap-2'>
                <Badge variant={backfill.running ? 'default' : 'secondary'}>
                  {backfill.running ? '运行中' : '已结束'}
                </Badge>
                {backfill.dry_run && <Badge variant='outline'>试运行</Badge>}
                <span className='text-muted-foreground'>{backfill.message}</span>
              </div>
              <div className='grid grid-cols-2 gap-2 sm:grid-cols-4'>
                <Stat label='已处理' value={backfill.processed} />
                <Stat label='已加水印' value={backfill.updated} />
                <Stat label='跳过' value={backfill.skipped} />
                <Stat label='失败' value={backfill.failed} />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className='pb-4'>
        <Button onClick={save} disabled={saving}>
          {saving ? (
            <Loader2 className='size-4 animate-spin' />
          ) : (
            <Save className='size-4' />
          )}
          {t('Save')}
        </Button>
      </div>
    </div>
  )
}

/** BadgePreview 用 CSS 近似还原服务端角标效果，便于调参时即时看到变化 */
function BadgePreview({ form }: { form: WatermarkMap }) {
  const ref = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ w: 0, h: 0 })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => setBox({ w: el.clientWidth, h: el.clientHeight })
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const shortest = Math.min(box.w, box.h) || 0
  const scale = Number(form.WatermarkFontScale) || 26
  const fontSize = Math.max(6, shortest / scale)
  const margin = Math.max(6, shortest / 45)
  const opacity = (Number(form.WatermarkOpacity) || 78) / 100
  const color = form.WatermarkColor || '#FFFFFF'
  const withBg = form.WatermarkBgEnabled === 'true'
  const light = isLightHex(color)
  const bg = withBg
    ? light
      ? `rgba(0,0,0,${opacity * 0.42})`
      : `rgba(255,255,255,${opacity * 0.55})`
    : 'transparent'

  const pos: Record<string, React.CSSProperties> = {
    'bottom-right': { right: margin, bottom: margin },
    'bottom-left': { left: margin, bottom: margin },
    'top-right': { right: margin, top: margin },
    'top-left': { left: margin, top: margin },
    center: { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' },
  }

  if (form.WatermarkEnabled !== 'true' || form.WatermarkExplicit !== 'true') {
    return (
      <div className='mx-auto flex aspect-[16/9] w-full max-w-[620px] items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 text-sm text-muted-foreground'>
        <ImageIcon className='mr-2 size-4' />
        显式标识已关闭，画面不带角标
      </div>
    )
  }

  return (
    <div
      ref={ref}
      className='relative mx-auto aspect-[16/9] w-full max-w-[620px] overflow-hidden rounded-xl shadow-sm ring-1 ring-black/5'
      style={{
        background:
          'linear-gradient(135deg, #1e293b 0%, #334155 35%, #475569 65%, #0f172a 100%)',
      }}
    >
      {/* 示意画面内容：几个虚化光斑，模拟真实作品的复杂度，便于判断对比度 */}
      <div className='pointer-events-none absolute inset-0 opacity-40'>
        <div className='absolute left-[12%] top-[18%] size-[70px] rounded-full bg-sky-400/50 blur-xl' />
        <div className='absolute right-[20%] top-[30%] size-[90px] rounded-full bg-fuchsia-400/40 blur-2xl' />
        <div className='absolute bottom-[10%] left-[35%] size-[60px] rounded-full bg-amber-300/40 blur-xl' />
        <div className='absolute bottom-[20%] right-[40%] size-[50px] rounded-full bg-emerald-300/30 blur-lg' />
      </div>

      <div
        className='absolute whitespace-nowrap px-[0.55em] py-[0.3em]'
        style={{
          ...(pos[form.WatermarkPosition] ?? pos['bottom-right']),
          fontSize,
          lineHeight: 1.15,
          color,
          opacity,
          background: bg,
          borderRadius: fontSize * 0.5,
          fontWeight: 500,
          letterSpacing: '0.01em',
        }}
      >
        {form.WatermarkText || 'AI 生成'}
      </div>
    </div>
  )
}

function isLightHex(hex: string) {
  const h = (hex || '#FFFFFF').replace('#', '')
  const full =
    h.length === 3 ? `${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}` : h
  const v = parseInt(full.slice(0, 6), 16)
  if (Number.isNaN(v)) return true
  const r = (v >> 16) & 0xff
  const g = (v >> 8) & 0xff
  const b = v & 0xff
  return 0.299 * r + 0.587 * g + 0.114 * b > 140
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className='rounded-md bg-background px-2 py-1.5'>
      <div className='text-muted-foreground'>{label}</div>
      <div className='font-mono text-sm font-medium'>{value}</div>
    </div>
  )
}

function Row({
  label,
  hint,
  children,
}: {
  label: ReactNode
  hint?: string
  children: ReactNode
}) {
  return (
    <div className='grid grid-cols-1 items-center gap-2 sm:grid-cols-[180px_1fr]'>
      <div>
        <span className='text-sm text-muted-foreground'>{label}</span>
        {hint && (
          <span className='block text-xs text-muted-foreground/70'>{hint}</span>
        )}
      </div>
      <div>{children}</div>
    </div>
  )
}
