/*
 * 生成结果区（位于创作卡片上方）
 * - 生成中：按比例占位的卡片，中央显示「N% 生成中…」，底部参数行
 * - 成功：图片填满卡片，参数行显示 模型 · 尺寸 · 比例
 * - 失败：显示原因 + 重试
 * 进度是本地模拟（OpenAI 兼容接口不返回真实进度），拿到结果即置 100%。
 */
import { AlertCircle, Download, RotateCcw } from 'lucide-react'

import { cn } from '@/lib/utils'

export type GenJob = {
  id: string
  prompt: string
  model: string
  ratio: string
  size: string
  /** 请求的张数（用于「0/2 生成中…」的分母） */
  count: number
  status: 'running' | 'done' | 'error'
  progress: number
  urls: string[]
  error?: string
  /** 提交时间（毫秒时间戳），卡片上展示到秒 */
  createdAt: number
}

/** 精确到年月日时分秒，例：2026-11-03 00:52:06 */
function formatJobTime(ts?: number): string {
  if (!ts) return ''
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

/** 比例 → CSS aspect-ratio */
function ratioToCss(ratio: string) {
  const [w, h] = ratio.split(':').map((n) => Number(n) || 1)
  return `${w} / ${h}`
}

export function GenerationResults({
  jobs,
  onRetry,
}: {
  jobs: GenJob[]
  onRetry: (job: GenJob) => void
}) {
  if (!jobs.length) return null

  const running = jobs.filter((j) => j.status === 'running').length
  const doneImages = jobs.reduce(
    (sum, j) => sum + (j.status === 'done' ? Math.max(1, j.urls.length) : 0),
    0
  )
  const done = doneImages + jobs.filter((j) => j.status === 'error').length
  const expected = jobs.reduce((sum, j) => sum + Math.max(1, j.count), 0)

  // 完成的任务按返回图片数铺开成多张卡片；运行中/失败仍是单卡
  const cards = jobs.flatMap((job) =>
    job.status === 'done' && job.urls.length
      ? job.urls.map((url) => ({ job, url }))
      : [{ job, url: null as string | null }]
  )

  return (
    <section className='w-full'>
      <div className='text-muted-foreground flex items-center justify-end gap-4 text-[13px]'>
        <span className='tabular-nums'>
          {running > 0
            ? `${done}/${expected} 生成中…`
            : `${doneImages} 张已完成`}
        </span>
        <button
          type='button'
          onClick={() => {
            window.scrollTo({
              top: document.body.scrollHeight,
              behavior: 'smooth',
            })
          }}
          className='hover:text-foreground transition-colors'
        >
          回到最底下
        </button>
      </div>

      {/* 一行一张：单列大图，避免多列时每张都被压到看不清细节 */}
      <div className='mx-auto mt-4 grid w-full max-w-[760px] grid-cols-1 gap-y-9'>
        {cards.map(({ job, url }) => (
          <article key={`${job.id}-${url ?? 'state'}`} className='min-w-0'>
            <div
              className='bg-muted relative w-full overflow-hidden rounded-[14px]'
              style={{ aspectRatio: ratioToCss(job.ratio) }}
            >
              {job.status === 'running' && (
                <div className='absolute inset-0 overflow-hidden'>
                  <div className='absolute inset-0 bg-[linear-gradient(120deg,var(--muted),var(--card),var(--muted))] bg-[length:200%_100%] opacity-90' />
                  <div className='absolute inset-0 flex flex-col items-center justify-center gap-1.5'>
                    <span className='text-foreground/70 text-[15px] font-medium tabular-nums'>
                      {job.progress}% 生成中…
                    </span>
                    <span className='text-muted-foreground max-w-[80%] truncate text-[12px]'>
                      {job.model}
                    </span>
                  </div>
                </div>
              )}

              {job.status === 'done' &&
                (url ? (
                  <img
                    src={url}
                    alt={job.prompt.slice(0, 40) || '生成结果'}
                    className='size-full object-cover'
                  />
                ) : (
                  <div className='text-muted-foreground flex size-full items-center justify-center text-[13px]'>
                    没有返回图片
                  </div>
                ))}

              {job.status === 'error' && (
                <div className='flex size-full flex-col items-center justify-center gap-2 px-5 text-center'>
                  <AlertCircle className='text-destructive size-5' />
                  <p className='text-muted-foreground line-clamp-2 text-[12px]'>
                    {job.error || '生成失败'}
                  </p>
                  <button
                    type='button'
                    onClick={() => onRetry(job)}
                    className='text-foreground border-border hover:bg-card mt-1 flex h-7 items-center gap-1 rounded-[8px] border px-2.5 text-[12px]'
                  >
                    <RotateCcw className='size-3' />
                    重试
                  </button>
                </div>
              )}

              {job.status === 'done' && url && (
                <a
                  href={url}
                  download
                  target='_blank'
                  rel='noopener noreferrer'
                  className='text-foreground absolute top-2 right-2 flex size-7 items-center justify-center rounded-[8px] bg-white/85 opacity-0 transition-opacity hover:opacity-100 focus:opacity-100'
                  title='下载'
                >
                  <Download className='size-3.5' />
                </a>
              )}
            </div>

            <div className='mt-2 flex items-center gap-2 text-[12px]'>
              <span className='text-muted-foreground truncate'>
                {job.model} · {job.size} · {job.ratio}
              </span>
            </div>
            {job.createdAt ? (
              <div className='text-muted-foreground/70 mt-0.5 text-[11.5px] tabular-nums'>
                {formatJobTime(job.createdAt)}
              </div>
            ) : null}
            {job.prompt && (
              <p className='text-muted-foreground/80 mt-1 line-clamp-1 text-[12px]'>
                {job.prompt}
              </p>
            )}
          </article>
        ))}
      </div>
    </section>
  )
}

/** 卡片在跑动时给个轻微的呼吸动画（Tailwind 没有现成的 shimmer，用 opacity 代替） */
export const shimmerClass = cn('animate-pulse')
