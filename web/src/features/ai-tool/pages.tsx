import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { openSignInDialog } from '@/features/auth/sign-in-dialog'
import { useAuthStore } from '@/stores/auth-store'

import { ComposerCard } from './composer-card'
import { BrandStrip } from './brand-strip'
import { GenerationResults, type GenJob } from './generation-results'
import { generateImages, resolveSize } from './lib/image-gen'
import { ShowcaseStrip, type ShowcaseItem } from './showcase-strip'
import { VideoComposerCard } from './video-composer'

const IMAGE_SHOWCASE: ShowcaseItem[] = [
  { id: '1', title: '春天露营面包插画', from: '#F3E3D0', to: '#B9C7A3' },
  { id: '2', title: '3D游戏人物渲染CG场景', from: '#A9D5C8', to: '#2F6E63' },
  { id: '3', title: '霓虹夜雨的赛博街景', from: '#6D7BD6', to: '#1B1E3A' },
  { id: '4', title: '水彩风山野小屋', from: '#D9E6F2', to: '#8AA7B8' },
  { id: '5', title: '国风水墨人物立绘', from: '#EFE6D8', to: '#8C7A63' },
  { id: '6', title: '手写笔触海报排版', from: '#F5E7D8', to: '#C9A88A' },
  { id: '7', title: '电商活动 KV 3D 渲染', from: '#CFE4F7', to: '#4B7DFF' },
  { id: '8', title: '春日饮料产品海报', from: '#BDE7C9', to: '#3E9C6B' },
]

const VIDEO_SHOWCASE: ShowcaseItem[] = [
  { id: 'v1', title: '蝴蝶香氛', from: '#E9D8C3', to: '#A8794F' },
  { id: 'v2', title: '生活不易，猫猫打工叹气', from: '#FFE08A', to: '#E0A11B' },
  { id: 'v3', title: '万物皆可猫猫头', from: '#E7EEF6', to: '#9DB2C6' },
  { id: 'v4', title: '打累了就休息', from: '#F6E6CE', to: '#C79A63' },
  { id: 'v5', title: '3d小猫蹲厕所', from: '#8FE3EF', to: '#2B9BB0' },
  { id: 'v6', title: 'eyes on you', from: '#2B3A67', to: '#0E1428' },
  { id: 'v7', title: '《水织幻境》', from: '#B9C6D6', to: '#5D6E85' },
  { id: 'v8', title: '绽放的味道', from: '#F3C6D6', to: '#B9748F' },
]

/**
 * 工作台页面壳：给 body 打标记，隐藏全站营销页脚（site-footer）。
 *
 * 生成器是「一屏工作台」——结果区自己滚、输入卡吸底，
 * 底部再挂一个三四百像素的营销页脚会直接把视口撑爆，
 * 输入卡就会跟着页面一起滚走。备案信息在首页/画廊页仍然展示。
 */
function useWorkbenchShell() {
  useEffect(() => {
    document.body.classList.add('ymm-workbench')
    return () => document.body.classList.remove('ymm-workbench')
  }, [])
}

export function ImageGeneratorPage() {
  useWorkbenchShell()
  const [jobs, setJobs] = useState<GenJob[]>([])
  const [generating, setGenerating] = useState(false)
  // 未登录时先弹登录框，别让请求 401 把整页踢到登录页
  const isLoggedIn = useAuthStore((state) => Boolean(state.auth.user))

  const runGeneration = async (input: {
    prompt: string
    model: string
    ratio: string
    clarity: string
    quality: string
    count: number
    images?: string[]
  }) => {
    if (!isLoggedIn) {
      openSignInDialog()
      return
    }
    const size = resolveSize(input.ratio, input.clarity).label
    const id = `job-${Date.now()}`
    const createdAt = Date.now()
    // 追加到末尾：新图从下方出现、把旧图往上顶，向上滚动即可回看历史
    setJobs((prev) => [
      ...prev,
      {
        id,
        prompt: input.prompt,
        model: input.model,
        ratio: input.ratio,
        size,
        count: Math.max(1, input.count || 1),
        status: 'running' as const,
        progress: 2,
        urls: [],
        createdAt,
      },
    ])
    setGenerating(true)

    // OpenAI 兼容接口不返回真实进度，这里做「缓慢逼近 92%」的假进度
    const timer = window.setInterval(() => {
      setJobs((prev) =>
        prev.map((job) =>
          job.id === id && job.status === 'running'
            ? { ...job, progress: Math.min(92, job.progress + 2 + Math.round(Math.random() * 4)) }
            : job
        )
      )
    }, 700)

    try {
      const out = await generateImages({
        model: input.model,
        prompt: input.prompt,
        ratio: input.ratio,
        clarity: input.clarity,
        quality: input.quality,
        count: input.count,
        images: input.images,
      })
      setJobs((prev) =>
        prev.map((job) =>
          job.id === id
            ? { ...job, status: 'done', progress: 100, urls: out.urls, size: out.size }
            : job
        )
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : '生成失败'
      toast.error(message)
      setJobs((prev) =>
        prev.map((job) =>
          job.id === id ? { ...job, status: 'error', error: message } : job
        )
      )
    } finally {
      window.clearInterval(timer)
      setGenerating(false)
    }
  }

  const hasJobs = jobs.length > 0
  const scrollRef = useRef<HTMLDivElement>(null)
  const jobCount = jobs.length

  // 每出一批新图，把结果区滚到最底部：
  // 输入卡是固定不动的，只有上面的结果区在滚，符合「新图往上顶」的观感
  useEffect(() => {
    if (jobCount === 0) return
    const el = scrollRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [jobCount])

  // 有结果后切到「结果区独立滚动 + 输入卡吸底」的布局
  if (hasJobs) {
    return (
      <div className='flex h-[calc(100svh_-_3.5rem)] flex-col overflow-hidden'>
        <div ref={scrollRef} className='min-h-0 flex-1 overflow-y-auto'>
          <div className='mx-auto w-full max-w-[1240px] px-6 pt-6 pb-8'>
            <div className='mx-auto w-[1000px] max-w-full'>
              <GenerationResults
                jobs={jobs}
                onRetry={(job) =>
                  void runGeneration({
                    prompt: job.prompt,
                    model: job.model,
                    ratio: job.ratio,
                    clarity: '1K',
                    quality: '标准',
                    count: job.count,
                  })
                }
              />
            </div>
          </div>
        </div>

        <div className='bg-background shrink-0'>
          <div className='mx-auto w-full max-w-[1240px] px-6 pb-5'>
            <div className='mx-auto w-[848px] max-w-full'>
              <ComposerCard
                active='image'
                category='image'
                generating={generating}
                placeholder='可直接文字生图，或上传图片输入文字指令对图片进行编辑，如：将背景改为雪夜'
                uploads={[
                  { key: 'style', label: '风格模型', tone: 'primary' },
                  { key: 'image', label: '图片' },
                ]}
                onGenerate={({ prompt, model, params, images }) =>
                  void runGeneration({
                    prompt,
                    model,
                    ratio: params.ratio,
                    clarity: params.clarity,
                    quality: params.quality,
                    count: Number(params.count.replace(/\D/g, '') || 1),
                    images,
                  })
                }
              />
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className='mx-auto w-full max-w-[1240px] px-6 pb-16'>
      {!hasJobs && (
        <div className='pt-[56px] text-center'>
          <h1 className='text-foreground text-[36px] leading-[1.2] font-medium'>
            图片创作
          </h1>
          <div className='mt-3 flex justify-center'>
            <BrandStrip subtitle='百变风格 超多模型供你选择' />
          </div>
        </div>
      )}

      <div className='mx-auto mt-[62px] w-[848px] max-w-full'>
        <ComposerCard
          active='image'
          category='image'
          generating={generating}
          placeholder='可直接文字生图，或上传图片输入文字指令对图片进行编辑，如：将背景改为雪夜'
          uploads={[
            { key: 'style', label: '风格模型', tone: 'primary' },
            { key: 'image', label: '图片' },
          ]}
          onGenerate={({ prompt, model, params, images }) =>
            void runGeneration({
              prompt,
              model,
              ratio: params.ratio,
              clarity: params.clarity,
              quality: params.quality,
              count: Number(params.count.replace(/\D/g, '') || 1),
              images,
            })
          }
        />
      </div>

      {!hasJobs && (
        <div className='mx-auto mt-[140px] w-full max-w-[1200px]'>
          <ShowcaseStrip items={IMAGE_SHOWCASE} />
        </div>
      )}
    </div>
  )
}

export function VideoGeneratorPage() {
  useWorkbenchShell()
  // 未登录时先弹登录框，别让请求 401 把整页踢到登录页
  const isLoggedIn = useAuthStore((state) => Boolean(state.auth.user))

  return (
    // 与图片生成页同一套壳：内容区自己滚、输入卡吸底，出来结果后页面不会整体位移
    <div className='flex h-[calc(100svh_-_3.5rem)] flex-col overflow-hidden'>
      <div className='min-h-0 flex-1 overflow-y-auto'>
        <div className='mx-auto w-full max-w-[1240px] px-6 pt-6 pb-8'>
          <div className='pt-[28px] text-center'>
            <h1 className='text-foreground text-[36px] leading-[1.2] font-medium'>
              视频创作
            </h1>
            <div className='mt-3 flex justify-center'>
              <BrandStrip subtitle='百变风格 超多模型供你选择' />
            </div>
          </div>

          <div className='mx-auto mt-[46px] w-full max-w-[1200px]'>
            <ShowcaseStrip items={VIDEO_SHOWCASE} />
          </div>
        </div>
      </div>

      <div className='bg-background shrink-0'>
        <div className='mx-auto w-full max-w-[1240px] px-6 pb-5'>
          <div className='mx-auto w-[848px] max-w-full'>
            <VideoComposerCard
              active='video'
              onGenerate={(payload) => {
                // 校验都在卡片内完成；视频 relay 通道尚未接入，先确认参数闭环
                if (!isLoggedIn) {
                  openSignInDialog()
                  return
                }
                const modeLabel =
                  payload.mode === 'frames' ? '首尾帧' : '全能参考'
                toast.success(
                  `视频任务已提交（${modeLabel} · ${payload.settings.quality} · ${payload.settings.duration}s）`
                )
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
