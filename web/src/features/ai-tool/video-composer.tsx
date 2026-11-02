/*
 * 视频生成编写卡
 * ------------------------------------------------------------------
 * 与图片卡同壳（Tabs / 提示词 / 底部控件 / 生成按钮），但参考素材区是双模式：
 *
 * ① 首尾帧（frames）：两个单图上传位
 *    - 首帧：必填，不传点生成会被拦下并提示
 *    - 尾帧：可选，留空即普通图生视频
 *    - 提示文案引导描述两帧之间的画面变化
 * ② 全能参考（omni）：视频 / 图片 / 音频三个素材位（各自可多选）
 *    - 无必须项，纯文字也能生成
 *    - 提示文案引导用 @图片1 / @视频1 / @音频1 引用素材
 *
 * 切换逻辑：素材按模式各存一份，来回切换不清空；上传位高度固定，
 * 切换只换这一行的内容，卡片整体高度与布局不动；占位文案随模式同步。
 *
 * 校验（点生成时）：
 * - 首尾帧模式没传首帧 → toast 拦截
 * - 任一素材还在上传中 → toast 拦截
 * - 任一素材上传失败 → toast 拦截并要求先移除
 *
 * 控件外观沿用 .ymm-dd 体系（磨砂菜单 / 聚焦环），空态上传位为虚线框。
 */
import {
  AlertCircle,
  ArrowUp,
  ChevronDown,
  GalleryHorizontalEnd,
  Languages,
  Loader2,
  Minus,
  Music,
  Plus,
  Scan,
  SquarePlay,
  Zap,
} from 'lucide-react'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { toast } from 'sonner'

import { ymmMenuClass, useYmmDropdown } from '@/components/ui/ymm-dropdown'
import { useModelsByCategory } from '@/hooks/use-model-catalog'
import { useServerModelsByCategory } from '@/hooks/use-server-model-catalog'
import {
  translatePromptToEnglish,
  TranslateError,
} from '@/lib/prompt-translate'
import { uploadImage } from '@/lib/storage'
import { cn } from '@/lib/utils'
import { ModelPickerDialog } from './model-picker'
import { TABS } from './composer-card'

/* ------------------------------------------------------------------ */
/* 模式与槽位定义                                                       */
/* ------------------------------------------------------------------ */

type ModeKey = 'frames' | 'omni'
type SlotKey = 'first' | 'last' | 'video' | 'image' | 'audio'

type SlotDef = {
  key: SlotKey
  label: string
  accept: string
  max: number
  multiple: boolean
}

const MODES: Record<
  ModeKey,
  {
    label: string
    icon: typeof SquarePlay
    hint: string
    placeholder: string
    slots: SlotDef[]
  }
> = {
  frames: {
    label: '首尾帧',
    icon: GalleryHorizontalEnd,
    hint: '上传图片作为视频的首帧与尾帧，尾帧可留空；两张图建议同比例，首帧必传',
    placeholder:
      '描述首帧到尾帧之间的画面变化，例如：镜头缓缓推近，人物抬头望向窗外，天色由黄昏转入夜',
    slots: [
      { key: 'first', label: '首帧', accept: 'image/*', max: 1, multiple: false },
      { key: 'last', label: '尾帧', accept: 'image/*', max: 1, multiple: false },
    ],
  },
  omni: {
    label: '全能参考',
    icon: SquarePlay,
    hint: '可上传视频 / 图片 / 音频作参考，在提示词里用 @视频1、@图片1、@音频1 引用；不传素材则按纯文字生成',
    placeholder:
      '输入你想要的画面，支持 @ 图片、视频、音频自由组合，例如：让@图片1动起来像@视频1，声音用@音频1的音色',
    slots: [
      { key: 'video', label: '视频', accept: 'video/*', max: 2, multiple: true },
      { key: 'image', label: '图片', accept: 'image/*', max: 3, multiple: true },
      { key: 'audio', label: '音频', accept: 'audio/*', max: 2, multiple: true },
    ],
  },
}

const MODE_ORDER: ModeKey[] = ['frames', 'omni']

/** 视频参数 */
export type VideoSettings = {
  ratio: string
  quality: string
  duration: number
  sound: boolean
}

export type VideoGenPayload = {
  prompt: string
  model: string
  mode: ModeKey
  settings: VideoSettings
  /** 上传成功（拿到站内地址）的素材，按用途分组 */
  assets: {
    first?: string
    last?: string
    videos: string[]
    images: string[]
    audios: string[]
  }
}

type Asset = {
  id: string
  url: string
  name: string
  remote: string
  failed?: boolean
}

type AssetStore = Record<ModeKey, Partial<Record<SlotKey, Asset[]>>>

const emptySlots = (): Partial<Record<SlotKey, Asset[]>> => ({})

const VIDEO_RATIOS = ['智能', '16:9', '4:3', '1:1', '3:4', '9:16', '21:9']
const VIDEO_QUALITIES = ['480P', '720P', '1080P']
const DURATION_MIN = 3
const DURATION_MAX = 10

/* ------------------------------------------------------------------ */
/* 主卡片                                                              */
/* ------------------------------------------------------------------ */

export function VideoComposerCard({
  active,
  generating = false,
  onGenerate,
}: {
  active: string
  generating?: boolean
  onGenerate?: (payload: VideoGenPayload) => void
}) {
  // 优先用 New API「模型资料」里的视频模型，为空时回退站点自定义目录
  const serverCatalog = useServerModelsByCategory('video')
  const fallbackCatalog = useModelsByCategory('video')
  const models =
    serverCatalog.models.length > 0 ? serverCatalog.models : fallbackCatalog
  const [mode, setMode] = useState<ModeKey>('frames')
  const [text, setText] = useState('')
  const [modelName, setModelName] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [translating, setTranslating] = useState(false)
  const [settings, setSettings] = useState<VideoSettings>({
    ratio: '智能',
    quality: '720P',
    duration: 5,
    sound: true,
  })

  // 两种模式的素材各存一份：来回切换不清空
  const [assets, setAssets] = useState<AssetStore>({
    frames: emptySlots(),
    omni: emptySlots(),
  })
  const modeAssets = assets[mode]
  const modeDef = MODES[mode]

  // 目录加载后默认选第一个可用模型
  useEffect(() => {
    if (!modelName && models.length) setModelName(models[0].name)
  }, [models, modelName])

  /* ---------------- 素材上传 ---------------- */

  const fileInput = useRef<HTMLInputElement>(null)
  /** 当前要填的槽位；accept / multiple 也由它驱动 */
  const [target, setTarget] = useState<{ mode: ModeKey; slot: SlotKey } | null>(
    null
  )
  const targetSlotDef = target
    ? MODES[target.mode].slots.find((s) => s.key === target.slot)
    : undefined

  const openPicker = (slot: SlotDef) => {
    const filled = (modeAssets[slot.key] ?? []).length
    if (filled >= slot.max) {
      toast.warning(`「${slot.label}」最多上传 ${slot.max} 个素材`)
      return
    }
    setTarget({ mode, slot: slot.key })
    // 状态先落，再触发 input（accept 是受控属性，得等渲染）
    requestAnimationFrame(() => fileInput.current?.click())
  }

  const addFiles = (files: FileList | null) => {
    if (!files?.length || !target) return
    const slotDef = MODES[target.mode].slots.find((s) => s.key === target.slot)
    if (!slotDef) return

    const existing = assets[target.mode][slotDef.key] ?? []
    const room = Math.max(0, slotDef.max - existing.length)
    const picked = Array.from(files).slice(0, room)
    if (!picked.length) {
      toast.warning(`「${slotDef.label}」最多上传 ${slotDef.max} 个素材`)
      return
    }

    const entries: Asset[] = picked.map((file) => ({
      id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2, 7)}`,
      url: URL.createObjectURL(file),
      name: file.name,
      remote: '',
    }))
    setAssets((prev) => ({
      ...prev,
      [target.mode]: {
        ...prev[target.mode],
        [slotDef.key]: [...(prev[target.mode][slotDef.key] ?? []), ...entries],
      },
    }))

    for (const [idx, entry] of entries.entries()) {
      const file = picked[idx]
      void uploadImage(file)
        .then(({ url }) =>
          setAssets((prev) => ({
            ...prev,
            [target!.mode]: {
              ...prev[target!.mode],
              [slotDef.key]: (prev[target!.mode][slotDef.key] ?? []).map((a) =>
                a.id === entry.id ? { ...a, remote: url } : a
              ),
            },
          }))
        )
        .catch(() => {
          setAssets((prev) => ({
            ...prev,
            [target!.mode]: {
              ...prev[target!.mode],
              [slotDef.key]: (prev[target!.mode][slotDef.key] ?? []).map((a) =>
                a.id === entry.id ? { ...a, failed: true } : a
              ),
            },
          }))
          toast.error(`「${entry.name}」上传失败，请移除后重新上传`)
        })
    }
  }

  const removeAsset = (slotKey: SlotKey, id: string) => {
    setAssets((prev) => {
      const list = prev[mode][slotKey] ?? []
      const hit = list.find((a) => a.id === id)
      if (hit) URL.revokeObjectURL(hit.url)
      return {
        ...prev,
        [mode]: { ...prev[mode], [slotKey]: list.filter((a) => a.id !== id) },
      }
    })
  }

  /* ---------------- 生成 ---------------- */

  const canGenerate = text.trim().length > 0

  const handleGenerate = () => {
    const prompt = text.trim()
    if (!prompt || generating) return

    if (mode === 'frames' && !(assets.frames.first ?? []).length) {
      toast.warning('首尾帧模式需要先上传首帧图片（尾帧可留空）')
      return
    }

    const all = Object.values(assets[mode]).flat()
    if (all.some((a) => !a.remote && !a.failed)) {
      toast.warning('素材还在上传中，请稍候再点生成')
      return
    }
    if (all.some((a) => a.failed)) {
      toast.error('有素材上传失败，请先移除带警示的素材再生成')
      return
    }

    const remoteOf = (key: SlotKey) =>
      (assets[mode][key] ?? []).map((a) => a.remote).filter(Boolean)

    onGenerate?.({
      prompt,
      model: modelName || models[0]?.name || '',
      mode,
      settings,
      assets: {
        first: remoteOf('first')[0],
        last: remoteOf('last')[0],
        videos: remoteOf('video'),
        images: remoteOf('image'),
        audios: remoteOf('audio'),
      },
    })
  }

  const handleTranslate = async () => {
    const source = text.trim()
    if (!source || translating) return
    setTranslating(true)
    try {
      const result = await translatePromptToEnglish(source)
      setText(result.text)
      toast.success(
        result.charged ? '已翻成英文（本次从余额扣费）' : '已翻成英文'
      )
    } catch (error) {
      const code = error instanceof TranslateError ? error.code : 'failed'
      toast.error(
        ({
          limited: '今日免费翻译次数已用完',
          need_quota: '额度不足，无法继续翻译',
          disabled: '管理员未开启提示词翻译',
          no_model: '管理员还没配置翻译模型',
        } as Record<string, string>)[code] ?? '翻译失败：请确认已登录，且后台已配置翻译通道'
      )
    } finally {
      setTranslating(false)
    }
  }

  // 消耗积分：按时长粗算（与后端计价对齐时可再调整）
  const cost = settings.duration * 10

  return (
    <div className='dark:bg-card w-full rounded-2xl bg-white p-[18px] shadow-[0_2px_16px_rgba(0,0,0,0.05)]'>
      {/* Tabs（与图片页共用） */}
      <div className='flex items-center gap-1'>
        {TABS.map((tab) => {
          const Icon = tab.icon
          const isActive = tab.key === active
          return (
            <span
              key={tab.key}
              className={`flex h-9 items-center gap-2 rounded-[10px] px-3 text-[16px] ${
                isActive
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-foreground/80 opacity-90'
              }`}
            >
              <Icon className='size-5' />
              <span>{tab.label}</span>
            </span>
          )
        })}
      </div>

      {/* 输入区：占位文案随参考模式切换 */}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={modeDef.placeholder}
        rows={3}
        className='text-foreground placeholder:text-muted-foreground/70 mt-2.5 min-h-[72px] w-full resize-none bg-transparent text-sm leading-[1.6] outline-none'
      />

      {/* 参考素材区：双模式上传位；固定最小高度保证切换时布局稳定 */}
      <div className='mt-2.5 flex min-h-[64px] flex-wrap items-center gap-3'>
        {modeDef.slots.map((slot) => {
          const list = modeAssets[slot.key] ?? []
          return (
            <span key={slot.key} className='flex flex-wrap items-center gap-3'>
              {list.map((asset) => (
                <AssetThumb
                  key={asset.id}
                  asset={asset}
                  label={slot.label}
                  onClick={() => openPicker(slot)}
                  onRemove={() => removeAsset(slot.key, asset.id)}
                />
              ))}
              {list.length < slot.max && (
                <button
                  type='button'
                  onClick={() => openPicker(slot)}
                  className='border-border text-muted-foreground hover:border-primary/50 hover:text-foreground flex size-[64px] flex-col items-center justify-center gap-1 rounded-[10px] border border-dashed text-[12px] transition-colors'
                >
                  <Plus className='size-4' />
                  <span>{slot.label}</span>
                </button>
              )}
            </span>
          )
        })}
      </div>
      {/* 模式说明（空态提示）：随模式同步更新 */}
      <p className='text-muted-foreground mt-2 text-[13px] leading-[1.6]'>
        {modeDef.hint}
      </p>

      {/* 底部控件 + 生成 */}
      <div className='mt-2.5 flex flex-wrap items-center gap-2'>
        {/* 参考模式切换 */}
        <ModeDropdown mode={mode} onChange={setMode} />

        {/* 视频参数：比例 | 清晰度 | 时长 | 声音 */}
        <VideoSettingsChip
          value={settings}
          onChange={(patch) => setSettings((prev) => ({ ...prev, ...patch }))}
        />

        <button
          type='button'
          onClick={() => setPickerOpen(true)}
          className='ymm-dd-btn'
        >
          <span className='text-primary'>✧</span>
          <span className='ymm-dd-label max-w-40'>{modelName || '选择模型'}</span>
          <ChevronDown className='text-muted-foreground size-3.5' />
        </button>

        <button
          type='button'
          onClick={handleTranslate}
          disabled={translating || !canGenerate}
          className='ymm-dd-btn ymm-dd-icon'
          aria-label='翻译提示词'
          title='把提示词翻成英文（走后台配置的翻译通道）'
        >
          {translating ? (
            <Loader2 className='size-3.5 animate-spin' />
          ) : (
            <Languages className='size-3.5' />
          )}
        </button>

        <button
          type='button'
          disabled={!canGenerate || generating}
          onClick={handleGenerate}
          className={`ml-auto flex h-9 items-center justify-center gap-1.5 rounded-full px-4 text-[14px] font-medium transition-colors ${
            canGenerate && !generating
              ? 'bg-foreground text-background hover:bg-foreground/90'
              : 'cursor-not-allowed bg-[#A8A8A8] text-[#666666]'
          }`}
        >
          {generating ? (
            <>
              <Loader2 className='size-3.5 animate-spin' />
              生成中
            </>
          ) : canGenerate ? (
            <>
              <Zap className='size-3.5' />
              {cost}
              <ArrowUp className='size-3.5' />
            </>
          ) : (
            <>
              生成
              <ArrowUp className='size-3.5' />
            </>
          )}
        </button>
      </div>

      <input
        ref={fileInput}
        type='file'
        accept={targetSlotDef?.accept ?? '*/*'}
        multiple={targetSlotDef?.multiple ?? false}
        hidden
        onChange={(e) => {
          addFiles(e.target.files)
          e.target.value = ''
        }}
      />

      <ModelPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        category='video'
        value={modelName}
        onSelect={(m) => setModelName(m.name)}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 参考模式下拉                                                         */
/* ------------------------------------------------------------------ */

function ModeDropdown({
  mode,
  onChange,
}: {
  mode: ModeKey
  onChange: (m: ModeKey) => void
}) {
  const { open, setOpen, ref } = useYmmDropdown()
  const menuRef = useRef<HTMLDivElement>(null)
  const [side, setSide] = useState<'up' | 'down'>('up')

  const show = () => {
    const host = ref.current?.getBoundingClientRect()
    const h = menuRef.current?.offsetHeight ?? 0
    if (host && h > 0) {
      const spaceUp = host.top - 64
      const spaceDown = window.innerHeight - host.bottom - 16
      setSide(spaceUp >= h + 8 || spaceUp >= spaceDown ? 'up' : 'down')
    }
    setOpen(true)
  }

  const current = MODES[mode]

  return (
    <div ref={ref} className={cn('ymm-dd', open && 'open')}>
      <button
        type='button'
        className='ymm-dd-btn'
        aria-label='参考素材模式'
        aria-expanded={open}
        onClick={() => (open ? setOpen(false) : show())}
      >
        <current.icon className='text-muted-foreground size-3.5' />
        <span>{current.label}</span>
        <ChevronDown className='chev size-3.5' />
      </button>

      <div
        ref={menuRef}
        className={ymmMenuClass({ align: 'start', side, className: 'w-[176px]' })}
      >
        {MODE_ORDER.map((key) => {
          const def = MODES[key]
          const Icon = def.icon
          return (
            <button
              key={key}
              type='button'
              className={cn('ymm-dd-item', key === mode && 'selected')}
              onClick={() => {
                onChange(key)
                setOpen(false)
              }}
            >
              <Icon className='text-muted-foreground size-4 shrink-0' />
              {def.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 视频参数面板                                                         */
/* ------------------------------------------------------------------ */

function VideoSettingsChip({
  value,
  onChange,
}: {
  value: VideoSettings
  onChange: (patch: Partial<VideoSettings>) => void
}) {
  const [open, setOpen] = useState(false)
  const [side, setSide] = useState<'up' | 'down'>('up')
  const ref = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const closeTimer = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const show = () => {
    const host = ref.current?.getBoundingClientRect()
    const h = menuRef.current?.offsetHeight ?? 0
    if (host && h > 0) {
      const spaceUp = host.top - 64
      const spaceDown = window.innerHeight - host.bottom - 16
      setSide(spaceUp >= h + 8 || spaceUp >= spaceDown ? 'up' : 'down')
    }
    setOpen(true)
  }

  const itemClass = (active: boolean) =>
    cn(
      'rounded-[8px] text-[13px] transition-colors',
      active
        ? 'bg-card text-foreground font-medium shadow-sm dark:bg-foreground/10'
        : 'text-muted-foreground hover:bg-card/70 dark:hover:bg-foreground/5'
    )

  const fill =
    ((value.duration - DURATION_MIN) / (DURATION_MAX - DURATION_MIN)) * 100

  return (
    <div
      ref={ref}
      onMouseEnter={() => {
        window.clearTimeout(closeTimer.current)
        show()
      }}
      onMouseLeave={() => {
        closeTimer.current = window.setTimeout(() => setOpen(false), 220)
      }}
      className={cn('ymm-dd', open && 'open')}
    >
      <button
        type='button'
        className='ymm-dd-btn'
        aria-label='视频参数'
        aria-expanded={open}
        onClick={show}
      >
        <Scan className='text-muted-foreground size-3.5' />
        <span>
          {value.ratio === '智能' ? '智能比例' : value.ratio} |{' '}
          {value.quality.toLowerCase()} | {value.duration}s |{' '}
          {value.sound ? '有配音' : '无配音'}
        </span>
        <ChevronDown className='chev size-3.5' />
      </button>

      <div
        ref={menuRef}
        className={ymmMenuClass({ align: 'start', side, className: 'w-[400px] p-4' })}
      >
        {/* 视频比例 */}
        <p className='text-muted-foreground text-[12px]'>视频比例</p>
        <div className='bg-muted mt-2 grid grid-cols-4 gap-1 rounded-[10px] p-1'>
          {VIDEO_RATIOS.map((r) => (
            <button
              key={r}
              type='button'
              onClick={() => onChange({ ratio: r })}
              className={cn(
                'flex h-[50px] flex-col items-center justify-center gap-1 text-[12px]',
                itemClass(r === value.ratio)
              )}
            >
              {r === '智能' ? (
                <Scan className='text-current size-[13px] opacity-70' />
              ) : (
                <RatioGlyph ratio={r} long={13} />
              )}
              <span>{r}</span>
            </button>
          ))}
        </div>

        {/* 视频质量 */}
        <p className='text-muted-foreground mt-3.5 text-[12px]'>视频质量</p>
        <div className='bg-muted mt-2 grid grid-cols-3 gap-1 rounded-[10px] p-1'>
          {VIDEO_QUALITIES.map((q) => (
            <button
              key={q}
              type='button'
              onClick={() => onChange({ quality: q })}
              className={cn('h-8', itemClass(q === value.quality))}
            >
              {q}
            </button>
          ))}
        </div>

        {/* 视频时长 */}
        <p className='text-muted-foreground mt-3.5 text-[12px]'>视频时长</p>
        <div className='mt-2 flex items-center gap-3'>
          <input
            type='range'
            min={DURATION_MIN}
            max={DURATION_MAX}
            step={1}
            value={value.duration}
            onChange={(e) => onChange({ duration: Number(e.target.value) })}
            className='ymm-slider flex-1'
            style={{ '--fill': `${fill}%` } as CSSProperties}
            aria-label='视频时长（秒）'
          />
          <span className='border-border text-foreground flex h-9 w-14 items-center justify-center rounded-[10px] border text-[13px] tabular-nums'>
            {value.duration} s
          </span>
        </div>

        {/* 同时生成声音 */}
        <p className='text-muted-foreground mt-3.5 text-[12px]'>同时生成声音</p>
        <div className='bg-muted mt-2 grid grid-cols-2 gap-1 rounded-[10px] p-1'>
          {[
            { label: '开启', on: true },
            { label: '关闭', on: false },
          ].map((opt) => (
            <button
              key={opt.label}
              type='button'
              onClick={() => onChange({ sound: opt.on })}
              className={cn('h-8', itemClass(value.sound === opt.on))}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

/** 画幅比例的小图标：按比例画出宽高不同的方框 */
function RatioGlyph({ ratio, long = 12 }: { ratio: string; long?: number }) {
  const [w, h] = ratio.split(':').map(Number)
  const short = Math.max(5, Math.round((long * Math.min(w, h)) / Math.max(w, h)))
  return (
    <span
      aria-hidden
      className='border-current shrink-0 rounded-[2px] border opacity-60'
      style={{ width: w >= h ? long : short, height: h >= w ? long : short }}
    />
  )
}

/* ------------------------------------------------------------------ */
/* 素材缩略图                                                           */
/* ------------------------------------------------------------------ */

function AssetThumb({
  asset,
  label,
  onClick,
  onRemove,
}: {
  asset: Asset
  label: string
  /** 点缩略图 = 重选这个槽位的素材 */
  onClick: () => void
  onRemove: () => void
}) {
  return (
    <div className='group/asset bg-muted relative size-[64px] overflow-hidden rounded-[10px]'>
      <button
        type='button'
        onClick={onClick}
        className='block size-full'
        aria-label={`替换${label}素材`}
        title={`点击替换${label}素材`}
      >
        {asset.name.match(/\.(mp4|webm|mov|mkv)$/i) ? (
          <video src={asset.url} muted preload='metadata' className='size-full object-cover' />
        ) : asset.name.match(/\.(mp3|wav|ogg|m4a|aac|flac)$/i) ? (
          <span className='bg-muted flex size-full items-center justify-center'>
            <Music className='text-muted-foreground size-5' />
          </span>
        ) : (
          <img src={asset.url} alt={asset.name} className='size-full object-cover' />
        )}
        {/* 上传中 / 上传失败的状态盖在缩略图上 */}
        {!asset.remote && (
          <span className='bg-foreground/55 absolute inset-0 flex items-center justify-center text-white'>
            {asset.failed ? (
              <AlertCircle className='size-4' />
            ) : (
              <Loader2 className='size-4 animate-spin' />
            )}
          </span>
        )}
      </button>
      <button
        type='button'
        onClick={onRemove}
        className='bg-foreground/70 absolute top-0.5 right-0.5 flex size-4 items-center justify-center rounded-full text-white opacity-0 transition-opacity group-hover/asset:opacity-100'
        aria-label={`移除${label}素材`}
      >
        <Minus className='size-3' />
      </button>
    </div>
  )
}
