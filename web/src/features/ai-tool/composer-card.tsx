/*
 * 生成器编写卡片（图片 / 视频共用）
 * 卡片尺寸取自 liblib /ai-tool/* 实测：848px、圆角 16、白底微阴影；
 * 选中 Tab 浅蓝填充 + 蓝字；上传位 52×52 圆角 8；生成按钮 88×32 胶囊。
 *
 * 控件一律走记忆规范 DESIGN-SYSTEM-YMM §I 的 .ymm-dd 体系
 * （see styles/ymm-dd.css + components/ui/ymm-dropdown.tsx）：
 * 半透明卡片底 + 磨砂、1px 描边、圆角 10、打开时主色聚焦环、菜单磨砂玻璃 + 圆角 14。
 *
 * 交互：
 * - 模型按钮 → 打开「选择模型」弹窗（数据来自后台模型目录，按类别过滤）
 * - 比例与张数合并为一个触发器，中间竖分割线分隔，悬浮即展开菜单
 * - 风格模型选中后逐个显示缩略图，悬浮缩略图弹出权重滑杆（0.1–1.5）
 */
import {
  AlertCircle,
  ArrowUp,
  ChevronDown,
  Image as ImageIcon,
  Languages,
  LayoutGrid,
  Maximize2,
  Loader2,
  Minus,
  Plus,
  Shuffle,
  Video,
  Zap,
} from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { toast } from 'sonner'

import { ymmMenuClass } from '@/components/ui/ymm-dropdown'
import type { PromptGalleryItem } from '@/features/prompt-gallery/types'
import { useModelsByCategory } from '@/hooks/use-model-catalog'
import { useServerModelsByCategory } from '@/hooks/use-server-model-catalog'
import {
  translatePromptToEnglish,
  TranslateError,
} from '@/lib/prompt-translate'
import type { ModelCategory } from '@/lib/model-catalog'
import { resolveImageUrl, uploadImage } from '@/lib/storage'
import { cn } from '@/lib/utils'
import { ModelPickerDialog } from './model-picker'
import { StylePickerDialog } from './style-picker'

type TabKey = 'image' | 'video' | 'action' | 'motion'

export type StyleSelection = { item: PromptGalleryItem; weight: number }

export const TABS: {
  key: TabKey
  label: string
  icon: typeof ImageIcon
  path?: string
}[] = [
  { key: 'image', label: '图片生成', icon: ImageIcon, path: '/ai-tool/image-generator' },
  { key: 'video', label: '视频生成', icon: Video, path: '/ai-tool/video-generator' },
  { key: 'action', label: '数字人', icon: Zap },
  { key: 'motion', label: '动作模仿', icon: LayoutGrid },
]

const RATIOS = ['1:1', '9:16', '16:9', '3:4', '4:3', '3:2', '2:3', '21:9']

const QUALITIES = ['标准', 'Pro']
const CLARITIES = ['1K', '2K']

/** 生成参数（纯 UI，尚未随请求下发） */
type GenParams = {
  quality: string
  clarity: string
  ratio: string
  count: string
}

/** 翻译失败码 → 中文提示（码表见 lib/prompt-translate.ts） */
const TRANSLATE_ERRORS: Record<string, string> = {
  limited: '今日免费翻译次数已用完',
  need_quota: '额度不足，无法继续翻译',
  disabled: '管理员未开启提示词翻译',
  no_model: '管理员还没配置翻译模型',
  failed: '翻译失败：请确认已登录，且后台已配置翻译通道',
}
const COUNTS = ['1张', '2张', '3张', '4张']

export type UploadSlot = {
  key: string
  label: string
  tone?: 'primary' | 'plain'
}

export function ComposerCard({
  active,
  placeholder,
  uploads,
  category,
  extraControls,
  showRatioCount = true,
  generating = false,
  onGenerate,
}: {
  active: TabKey
  placeholder: string
  uploads: UploadSlot[]
  category: ModelCategory
  extraControls?: ReactNode
  showRatioCount?: boolean
  generating?: boolean
  /** 点「生成」时把当前参数交给页面去发请求 */
  onGenerate?: (payload: {
    prompt: string
    model: string
    params: GenParams
    images: string[]
  }) => void
}) {
  const navigate = useNavigate()
  // 优先用 New API「模型资料」（图标/说明/标签来自后台），为空时回退站点自定义目录
  const serverCatalog = useServerModelsByCategory(category)
  const fallbackCatalog = useModelsByCategory(category)
  const models =
    serverCatalog.models.length > 0 ? serverCatalog.models : fallbackCatalog
  const [text, setText] = useState('')
  const [modelName, setModelName] = useState<string>('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [params, setParams] = useState<GenParams>({
    quality: '标准',
    clarity: '2K',
    ratio: '1:1',
    count: '1张',
  })
  const patchParams = (p: Partial<GenParams>) =>
    setParams((prev) => ({ ...prev, ...p }))
  const [styleOpen, setStyleOpen] = useState(false)
  /** 非空 = 正在替换该槽位（点已有缩略图进入）；null = 新增选择 */
  const [replaceAt, setReplaceAt] = useState<number | null>(null)
  const [styles, setStyles] = useState<StyleSelection[]>([])

  // 目录加载后默认选第一个可用模型
  useEffect(() => {
    if (!modelName && models.length) setModelName(models[0].name)
  }, [models, modelName])

  const [translating, setTranslating] = useState(false)
  const canGenerate = text.trim().length > 0

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
      toast.error(TRANSLATE_ERRORS[code] ?? TRANSLATE_ERRORS.failed)
    } finally {
      setTranslating(false)
    }
  }

  const MAX_STYLES = 3

  // 点缩略图即切换：已选 → 取消；未选 → 新增（满 3 个时替换最早选的那个）
  const toggleStyle = (item: PromptGalleryItem) => {
    setStyles((prev) => {
      if (prev.some((s) => s.item.id === item.id)) {
        return prev.filter((s) => s.item.id !== item.id)
      }
      const next = [...prev, { item, weight: 1 }]
      return next.length > MAX_STYLES ? next.slice(next.length - MAX_STYLES) : next
    })
  }

  // 替换某个已选槽位：内容换掉、权重与位置保留；若目标素材已在别的槽位则两个槽位互换，避免重复
  const replaceStyle = (item: PromptGalleryItem) => {
    setStyles((prev) => {
      if (replaceAt === null) return prev
      const old = prev[replaceAt]?.item
      const next = prev.map((s, i) => (i === replaceAt ? { ...s, item } : s))
      const dup = next.findIndex((s, i) => i !== replaceAt && s.item.id === item.id)
      if (dup !== -1 && old) next[dup] = { ...next[dup], item: old }
      return next
    })
    setStyleOpen(false)
    setReplaceAt(null)
  }

  // 参考图：本地先出预览，同时上传到站内存储，生成时带的是可访问地址
  const fileInput = useRef<HTMLInputElement>(null)
  const [refs, setRefs] = useState<
    { id: string; url: string; name: string; remote?: string; failed?: boolean }[]
  >([])

  const addFiles = (files: FileList | null) => {
    if (!files?.length) return
    const room = Math.max(0, 4 - refs.length)
    const picked = Array.from(files)
      .slice(0, room)
      .map((file) => ({
        file,
        entry: {
          id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2, 7)}`,
          url: URL.createObjectURL(file),
          name: file.name,
          remote: '',
        },
      }))
    if (!picked.length) return
    setRefs((prev) => [...prev, ...picked.map((p) => p.entry)].slice(0, 4))

    for (const { file, entry } of picked) {
      void uploadImage(file)
        .then(({ url }) =>
          setRefs((prev) =>
            prev.map((r) => (r.id === entry.id ? { ...r, remote: url } : r))
          )
        )
        .catch(() => {
          setRefs((prev) =>
            prev.map((r) => (r.id === entry.id ? { ...r, failed: true } : r))
          )
          toast.error(`「${file.name}」上传失败，生成时不会带上它`)
        })
    }
  }

  // 消耗积分展示（每张 5 点，与后端计价对齐时可再调整）
  const cost = Math.max(1, Number(params.count.replace(/\D/g, '') || 1)) * 5

  const handleGenerate = () => {
    const prompt = text.trim()
    if (!prompt || generating) return
    onGenerate?.({
      prompt,
      model: modelName || models[0]?.name || '',
      params,
      // 只带上已上传成功的地址；blob: 预览地址后端拿不到
      images: refs.map((r) => r.remote ?? '').filter(Boolean),
    })
  }

  const setWeight = (id: number, weight: number) =>
    setStyles((prev) => prev.map((s) => (s.item.id === id ? { ...s, weight } : s)))

  const removeStyle = (id: number) =>
    setStyles((prev) => prev.filter((s) => s.item.id !== id))

  return (
    <div className='dark:bg-card w-full rounded-2xl bg-white p-[18px] shadow-[0_2px_16px_rgba(0,0,0,0.05)]'>
      {/* Tabs */}
      <div className='flex items-center gap-1'>
        {TABS.map((tab) => {
          const Icon = tab.icon
          const isActive = tab.key === active
          return (
            <button
              key={tab.key}
              type='button'
              onClick={() => {
                if (tab.path) navigate({ to: tab.path })
              }}
              className={`flex h-9 items-center gap-2 rounded-[10px] px-3 text-[16px] transition-colors ${
                isActive
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-foreground/80 hover:bg-foreground/5'
              } ${tab.path ? 'cursor-pointer' : 'cursor-default opacity-60'}`}
            >
              <Icon className='size-5' />
              <span>{tab.label}</span>
            </button>
          )
        })}
        <button
          type='button'
          className='text-muted-foreground hover:text-foreground ml-auto flex size-8 items-center justify-center rounded-[8px] transition-colors'
          aria-label='全屏编辑'
          title='全屏编辑'
        >
          <Maximize2 className='size-4' />
        </button>
      </div>

      {/* 输入区 */}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className='text-foreground placeholder:text-muted-foreground/70 mt-2.5 min-h-[72px] w-full resize-none bg-transparent text-sm leading-[1.6] outline-none'
      />

      {/* 上传位 + 已选风格缩略图 */}
      <div className='mt-2.5 flex flex-wrap items-center gap-2'>
        {uploads.map((slot) =>
          slot.key === 'style' ? (
            <span key={slot.key} className='flex flex-wrap items-center gap-2'>
              {styles.map((sel, idx) => (
                <StyleThumb
                  key={sel.item.id}
                  selection={sel}
                  onReplace={() => {
                    setReplaceAt(idx)
                    setStyleOpen(true)
                  }}
                  onWeight={(w) => setWeight(sel.item.id, w)}
                  onRemove={() => removeStyle(sel.item.id)}
                />
              ))}
              {/* 满 3 个后不再显示入口（框体只留 3 个缩略图）；要换就点缩略图进替换模式 */}
              {styles.length < MAX_STYLES && (
                <UploadTile
                  slot={slot}
                  count={styles.length}
                  onClick={() => {
                    setReplaceAt(null)
                    setStyleOpen(true)
                  }}
                />
              )}
            </span>
          ) : (
            <span key={slot.key} className='flex flex-wrap items-center gap-2'>
              {refs.map((ref) => (
                <div
                  key={ref.id}
                  className='group/ref bg-muted relative size-[52px] overflow-hidden rounded-[8px]'
                >
                  <img
                    src={ref.url}
                    alt={ref.name}
                    className='size-full object-cover'
                  />
                  {/* 上传中 / 上传失败的状态盖在缩略图上 */}
                  {!ref.remote && (
                    <span className='bg-foreground/55 absolute inset-0 flex items-center justify-center text-white'>
                      {ref.failed ? (
                        <AlertCircle className='size-4' />
                      ) : (
                        <Loader2 className='size-4 animate-spin' />
                      )}
                    </span>
                  )}
                  <button
                    type='button'
                    onClick={() => {
                      URL.revokeObjectURL(ref.url)
                      setRefs((prev) => prev.filter((r) => r.id !== ref.id))
                    }}
                    className='bg-foreground/70 absolute top-0.5 right-0.5 flex size-4 items-center justify-center rounded-full text-white opacity-0 transition-opacity group-hover/ref:opacity-100'
                    aria-label='移除图片'
                  >
                    <Minus className='size-3' />
                  </button>
                </div>
              ))}
              {refs.length < 4 && (
                <UploadTile
                  slot={slot}
                  onClick={() => fileInput.current?.click()}
                />
              )}
            </span>
          )
        )}
      </div>

      {/* 底部控件 + 生成 */}
      <div className='mt-2.5 flex flex-wrap items-center gap-2'>
        {/* 触发器与 .ymm-dd 同款，但打开的是弹窗而不是菜单 */}
        <button
          type='button'
          onClick={() => setPickerOpen(true)}
          className='ymm-dd-btn'
        >
          <span className='text-primary'>✧</span>
          <span className='ymm-dd-label max-w-40'>{modelName || '选择模型'}</span>
          <ChevronDown className='text-muted-foreground size-3.5' />
        </button>

        {showRatioCount && (
          <GenSettingsChip value={params} onChange={patchParams} />
        )}

        {extraControls}

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
        accept='image/*'
        multiple
        hidden
        onChange={(e) => {
          addFiles(e.target.files)
          e.target.value = ''
        }}
      />

      <StylePickerDialog
        open={styleOpen}
        onOpenChange={(v) => {
          setStyleOpen(v)
          if (!v) setReplaceAt(null)
        }}
        selectedItems={styles.map((s) => s.item)}
        onToggle={toggleStyle}
        replacingIndex={replaceAt}
        onReplace={replaceStyle}
      />

      <ModelPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        category={category}
        value={modelName}
        onSelect={(m) => setModelName(m.name)}
      />
    </div>
  )
}

/** 已选风格缩略图：权重居中压图，悬停出现移除按钮与权重浮层（磨砂面板） */
function StyleThumb({
  selection,
  onReplace,
  onWeight,
  onRemove,
}: {
  selection: StyleSelection
  /** 点击缩略图 = 替换这个槽位的内容 */
  onReplace: () => void
  onWeight: (w: number) => void
  onRemove: () => void
}) {
  const [open, setOpen] = useState(false)
  /** 数值框的编辑态草稿（null = 显示当前权重） */
  const [draft, setDraft] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const openTimer = useRef<number | undefined>(undefined)
  const closeTimer = useRef<number | undefined>(undefined)

  // 输入后提交：非法回退、越界钳制到 0.1–1.5、保留一位小数
  const commitDraft = () => {
    if (draft === null) return
    const n = Number(draft.replace(/[^\d.]/g, ''))
    if (Number.isFinite(n) && draft.trim() !== '') {
      const clamped = Math.min(1.5, Math.max(0.1, Math.round(n * 10) / 10))
      onWeight(clamped)
    }
    setDraft(null)
  }

  const showLater = () => {
    window.clearTimeout(closeTimer.current)
    openTimer.current = window.setTimeout(() => setOpen(true), 120)
  }
  const hideLater = () => {
    window.clearTimeout(openTimer.current)
    closeTimer.current = window.setTimeout(() => {
      // 正在数值框里输入时不收面板
      if (ref.current && ref.current.contains(document.activeElement)) return
      setOpen(false)
    }, 200)
  }
  const raw = selection.item.cover ?? ''
  const cover = /^(data:|https?:)/i.test(raw) ? raw : resolveImageUrl(raw)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const fill = ((selection.weight - 0.1) / (1.5 - 0.1)) * 100

  return (
    <div ref={ref} className='relative' onMouseEnter={showLater} onMouseLeave={hideLater}>
      <div className='group/thumb bg-muted relative size-[52px] overflow-hidden rounded-[8px]'>
        <button
          type='button'
          onClick={() => {
            // 点击 = 换素材；权重靠悬停面板调
            window.clearTimeout(closeTimer.current)
            setOpen(false)
            onReplace()
          }}
          onFocus={() => setOpen(true)}
          className='block size-full'
          aria-label='替换风格素材'
          title='点击替换素材，悬停调权重'
        >
          {cover ? (
            <img
              src={cover}
              alt={selection.item.title}
              className='size-full object-cover'
            />
          ) : (
            <span className='bg-muted block size-full' />
          )}
          <span className='absolute inset-0 flex items-center justify-center text-[15px] font-bold text-white [text-shadow:0_1px_4px_rgba(0,0,0,0.55)]'>
            {selection.weight.toFixed(1)}
          </span>
        </button>
        <button
          type='button'
          onClick={onRemove}
          className='bg-foreground/70 absolute top-0.5 right-0.5 flex size-4 items-center justify-center rounded-full text-white opacity-0 transition-opacity group-hover/thumb:opacity-100'
          aria-label='移除风格'
        >
          <Minus className='size-3' />
        </button>
      </div>

      {open && (
        <div className='ymm-glass-menu absolute bottom-[calc(100%+8px)] left-0 z-30 w-[268px] p-3.5'>
          <p className='text-foreground truncate text-[13px] font-medium'>
            {selection.item.title}
          </p>
          <div className='mt-2 flex items-center gap-3'>
            <input
              type='range'
              min={0.1}
              max={1.5}
              step={0.1}
              value={selection.weight}
              onChange={(e) => onWeight(Number(e.target.value))}
              className='ymm-slider flex-1'
              style={{ '--fill': `${fill}%` } as CSSProperties}
              aria-label='风格权重'
            />
            <input
              value={draft ?? selection.weight.toFixed(1)}
              onChange={(e) => setDraft(e.target.value)}
              onFocus={(e) => {
                setDraft(selection.weight.toFixed(1))
                e.currentTarget.select()
              }}
              onBlur={commitDraft}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  commitDraft()
                  e.currentTarget.blur()
                } else if (e.key === 'Escape') {
                  setDraft(null)
                  e.currentTarget.blur()
                }
              }}
              inputMode='decimal'
              maxLength={4}
              aria-label='权重数值，0.1 到 1.5'
              title='点击可直接输入 0.1–1.5'
              className='border-border text-foreground hover:border-foreground/25 focus:border-primary h-7 w-12 cursor-text rounded-[8px] border bg-transparent text-center text-[13px] tabular-nums transition-colors outline-none focus:[box-shadow:0_0_0_3px_var(--ymm-ring)]'
            />
          </div>
        </div>
      )}
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

/** 生成参数触发器：`▭ 16:9 | 1张`，点开是一个面板（质量 / 清晰度 / 尺寸 / 张数） */
function GenSettingsChip({
  value,
  onChange,
}: {
  value: GenParams
  onChange: (patch: Partial<GenParams>) => void
}) {
  const [open, setOpen] = useState(false)
  /** 面板默认向上弹；上方空间不够时改向下，避免盖住顶栏或跑出视口 */
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
      const spaceUp = host.top - 64 // 顶栏 56 + 8 间距
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
        aria-label='生成参数'
        aria-expanded={open}
        onClick={show}
      >
        <RatioGlyph ratio={value.ratio} />
        <span>{value.ratio}</span>
        <span aria-hidden className='bg-border h-3.5 w-px' />
        <span>{value.count}</span>
        <ChevronDown className='chev size-3.5' />
      </button>

      <div
        ref={menuRef}
        className={ymmMenuClass({ align: 'start', side, className: 'w-[336px] p-3.5' })}
      >
        {/* 图片质量 */}
        <p className='text-muted-foreground text-[12px]'>图片质量</p>
        <div className='bg-muted mt-2 grid grid-cols-2 gap-1 rounded-[10px] p-1'>
          {QUALITIES.map((q) => (
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

        {/* 清晰度 */}
        <p className='text-muted-foreground mt-3.5 text-[12px]'>清晰度</p>
        <div className='bg-muted mt-2 grid grid-cols-2 gap-1 rounded-[10px] p-1'>
          {CLARITIES.map((c) => (
            <button
              key={c}
              type='button'
              onClick={() => onChange({ clarity: c })}
              className={cn('h-8', itemClass(c === value.clarity))}
            >
              {c}
            </button>
          ))}
        </div>

        {/* 图片尺寸 */}
        <p className='text-muted-foreground mt-3.5 text-[12px]'>图片尺寸</p>
        <div className='bg-muted mt-2 grid grid-cols-4 gap-1 rounded-[10px] p-1'>
          {RATIOS.map((r) => (
            <button
              key={r}
              type='button'
              onClick={() => onChange({ ratio: r })}
              className={cn(
                'flex h-[50px] flex-col items-center justify-center gap-1.5 text-[12px]',
                itemClass(r === value.ratio)
              )}
            >
              <RatioGlyph ratio={r} long={13} />
              <span>{r}</span>
            </button>
          ))}
        </div>

        {/* 图片张数 */}
        <p className='text-muted-foreground mt-3.5 text-[12px]'>图片张数</p>
        <div className='bg-muted mt-2 grid grid-cols-4 gap-1 rounded-[10px] p-1'>
          {COUNTS.map((c) => (
            <button
              key={c}
              type='button'
              onClick={() => onChange({ count: c })}
              className={cn('h-8', itemClass(c === value.count))}
            >
              {c}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function UploadTile({
  slot,
  count = 0,
  onClick,
}: {
  slot: UploadSlot
  count?: number
  onClick?: () => void
}) {
  const primary = slot.tone === 'primary'
  return (
    <button
      type='button'
      onClick={onClick}
      className={`relative flex size-[52px] flex-col items-center justify-center gap-0.5 rounded-[8px] text-[10px] leading-none transition-colors ${
        primary
          ? 'bg-primary text-primary-foreground hover:bg-primary/90'
          : 'bg-[#F7F7F7] text-muted-foreground hover:bg-[#EFEFEF] dark:bg-muted/40'
      }`}
    >
      {primary ? <Shuffle className='size-4' /> : <Plus className='size-4' />}
      <span className='whitespace-nowrap'>{slot.label}</span>
      {/* 已选数量做成角标，避免文案换行把 52px 方块挤成三行 */}
      {count > 0 && (
        <span className='bg-foreground text-background absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full text-[9px] font-semibold'>
          {count}
        </span>
      )}
    </button>
  )
}

/** 通用控件胶囊（视频页的「全能参考」「智能比例 | 720p …」等），与下拉同款外观 */
export function Chip({ children }: { children: ReactNode }) {
  return (
    <button type='button' className='ymm-dd-btn'>
      {children}
    </button>
  )
}
