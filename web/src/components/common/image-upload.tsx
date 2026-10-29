import { type ChangeEvent, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ImagePlus, Loader2, X } from 'lucide-react'

import { uploadImage } from '@/lib/storage'

interface ImageUploadProps {
  value?: string
  onChange?: (url: string) => void
  placeholder?: string
  disabled?: boolean
}

// 全站通用的图片上传组件：点击选择文件 -> 调 /api/storage/upload -> 回填 URL。
// 不关心底层是本地还是云存储（由后台设置决定）。
export function ImageUpload({
  value,
  onChange,
  placeholder,
  disabled,
}: ImageUploadProps) {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>()

  async function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    // 允许再次选择同一文件
    e.target.value = ''
    if (!file) return
    setError(undefined)
    setLoading(true)
    try {
      const url = await uploadImage(file)
      onChange?.(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleChange}
        disabled={disabled || loading}
      />
      {value ? (
        <div className="group relative overflow-hidden rounded-lg border border-stone-200 dark:border-stone-700">
          <img
            src={value}
            alt=""
            className="h-40 w-full object-cover"
            loading="lazy"
            decoding="async"
          />
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
          className="flex h-40 w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-stone-300 text-sm text-stone-500 transition hover:border-blue-500 hover:text-stone-700 dark:border-stone-600 dark:text-stone-400 dark:hover:text-stone-200"
        >
          {loading ? (
            <Loader2 className="size-6 animate-spin" />
          ) : (
            <ImagePlus className="size-6" />
          )}
          <span>
            {loading
              ? t('Uploading…')
              : (placeholder ?? t('Click to upload image'))}
          </span>
        </button>
      )}
      {!value && !disabled && (
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
