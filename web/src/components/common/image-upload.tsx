import { type ChangeEvent, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ImagePlus, Loader2, X } from 'lucide-react'

import { uploadImage, useResolvedImageUrl } from '@/lib/storage'
import { cn } from '@/lib/utils'

interface ImageUploadProps {
  /** 可以是上传返回的 key（uploads/...）或任意完整 URL；预览时自动按地域解析 */
  value?: string
  /** 上传成功后回调，传相对 key（数据库存 key，展示时按地域解析成国内外地址） */
  onChange?: (value: string) => void
  /**
   * 用户选中文件、尚未上传时触发（在 uploadImage 之前）。
   * 用于从文件本身提取元数据（如 ComfyUI 写进 PNG 的提示词）。
   * 抛错会被忽略，绝不影响上传。
   */
  onFileSelected?: (file: File) => void
  placeholder?: string
  disabled?: boolean
}

// 全站通用的图片上传组件：点击选择文件 -> 调 /api/storage/upload -> 回填 key。
// 不关心底层是本地还是云存储、国内还是海外镜像（由后台设置决定）。
export function ImageUpload({
  value,
  onChange,
  onFileSelected,
  placeholder,
  disabled,
}: ImageUploadProps) {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>()
  const [dragging, setDragging] = useState(false)
  // 拖拽进入/离开会在子元素间反复触发，用计数器判断是否真的离开了容器
  const dragDepth = useRef(0)
  const previewUrl = useResolvedImageUrl(value)

  /** 真正干活的上传：选文件和拖拽都走这里，避免两份逻辑跑偏 */
  async function upload(file: File) {
    setError(undefined)
    // 元数据提取是「锦上添花」，任何异常都只能吞掉：
    // 绝不允许一个解析失败把上传也一起拦住。
    // 用 Promise.resolve().catch 而不是 try/catch —— 回调可能是 async 函数，
    // 同步 try/catch 抓不到它返回的 rejected promise（会变成 unhandled rejection）。
    Promise.resolve()
      .then(() => onFileSelected?.(file))
      .catch(() => {
        /* empty */
      })
    setLoading(true)
    try {
      const { key } = await uploadImage(file)
      onChange?.(key)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  async function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    // 允许再次选择同一文件
    e.target.value = ''
    if (!file) return
    await upload(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    dragDepth.current = 0
    setDragging(false)
    if (disabled || loading) return
    const file = e.dataTransfer.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError(t('Please drop an image file.'))
      return
    }
    void upload(file)
  }

  return (
    <div
      className="space-y-2"
      onDragEnter={(e) => {
        e.preventDefault()
        if (disabled || loading) return
        dragDepth.current += 1
        setDragging(true)
      }}
      onDragOver={(e) => {
        // 必须 preventDefault，否则浏览器会用默认行为打开图片
        e.preventDefault()
        if (!disabled && !loading) e.dataTransfer.dropEffect = 'copy'
      }}
      onDragLeave={(e) => {
        e.preventDefault()
        dragDepth.current -= 1
        if (dragDepth.current <= 0) {
          dragDepth.current = 0
          setDragging(false)
        }
      }}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleChange}
        disabled={disabled || loading}
      />
      {previewUrl ? (
        <div
          className={cn(
            'group relative overflow-hidden rounded-lg border transition',
            dragging
              ? 'border-blue-500 ring-2 ring-blue-500/30'
              : 'border-stone-200 dark:border-stone-700'
          )}
        >
          <img
            src={previewUrl}
            alt=""
            className="h-40 w-full object-cover"
            loading="lazy"
            decoding="async"
          />
          {dragging && (
            <div className="absolute inset-0 flex items-center justify-center bg-blue-500/15 text-xs font-medium text-blue-700 dark:text-blue-300">
              {t('Drop to replace')}
            </div>
          )}
          {!disabled && (
            <button
              type="button"
              onClick={() => onChange?.('')}
              className="absolute right-2 top-2 rounded-full bg-black/60 p-1 text-white opacity-0 transition group-hover:opacity-100"
              aria-label={t('Remove image')}
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled || loading}
          onClick={() => inputRef.current?.click()}
          className={cn(
            'flex h-40 w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-sm transition',
            dragging
              ? 'border-blue-500 bg-blue-500/5 text-blue-600 dark:text-blue-400'
              : 'border-stone-300 text-stone-500 hover:border-blue-500 hover:text-stone-700 dark:border-stone-600 dark:text-stone-400 dark:hover:text-stone-200'
          )}
        >
          {loading ? (
            <Loader2 className="size-6 animate-spin" />
          ) : (
            <ImagePlus className="size-6" />
          )}
          <span>
            {loading
              ? t('Uploading…')
              : dragging
                ? t('Drop image here')
                : (placeholder ?? t('Click or drag an image here'))}
          </span>
          {!loading && !dragging && (
            <span className="text-[11px] text-stone-400 dark:text-stone-500">
              {t('PNG / JPG / WebP, up to 15MB')}
            </span>
          )}
        </button>
      )}
      {!previewUrl && !disabled && (
        <button
          type="button"
          disabled={loading}
          onClick={() => inputRef.current?.click()}
          className="text-xs text-blue-600 hover:underline dark:text-blue-400"
        >
          {loading ? t('Uploading…') : t('Select image file')}
        </button>
      )}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
