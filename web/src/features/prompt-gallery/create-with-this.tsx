/**
 * 「去创作」入口（二开）
 * ------------------------------------------------------------------
 * 一屏给出四种把「作品」变成「我的图」的方式，具体显示哪几种由后台开关
 * （GalleryCreateConfig）决定：
 *
 *  1. 网盘手动下载  —— 列出模型在夸克/百度等网盘的分享链接，客户自行下载
 *  2. ComfyUI 一键  —— 唤起本地 ComfyUI（ymm-bridge 节点）自动下模型 + 载工作流
 *  3. RunningHub    —— 跳转云端 ComfyUI 工作流体验页，无需本地安装
 *  4. 手动工作流    —— 下载 ComfyUI 工作流 JSON，拖进本地 ComfyUI 使用
 *
 * 数据来自公开接口 GET /prompts/:id/create（工作流 JSON + 模型来源 + RH id）。
 * 某个入口即使后台开着，但作品没配对应数据时也会自动隐藏 ——
 * 不给用户点进去发现「没东西」的空按钮。
 */
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  Cloud,
  Download,
  ExternalLink,
  HardDriveDownload,
  Loader2,
  Sparkles,
  Wand2,
} from 'lucide-react'
import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { runningHubWorkflowUrl } from '@/features/canvas/runninghub'
import { BRIDGE_PAGE_PATH } from '@/features/comfyui-bridge/config'
import { cn } from '@/lib/utils'

import { getGalleryCreatePayload } from './api'
import type { GalleryModelSource, PromptGalleryItem } from './types'
import { useGalleryCreateConfig } from './use-gallery-create-config'

/** 网盘类来源：这些 type 走「手动下载」，不做自动拉取 */
const NETDISK_TYPES = new Set(['quark', 'netdisk', 'baidu', 'aliyun', 'pan'])

function isNetdisk(source: GalleryModelSource): boolean {
  return NETDISK_TYPES.has((source.type || '').toLowerCase())
}

/** 本地 ComfyUI 默认地址；ymm-bridge 节点靠这两个参数取数据 */
function buildComfyNodeUrl(galleryId: number): string {
  const origin = typeof window === 'undefined' ? '' : window.location.origin
  const params = new URLSearchParams({
    ymm_gallery: String(galleryId),
    ymm_site: origin,
  })
  return `http://127.0.0.1:8188/?${params.toString()}`
}

/** 把工作流 JSON 下载成文件，客户拖进 ComfyUI 即可 */
function downloadWorkflow(title: string, workflowJson: string) {
  const safe = (title || 'workflow').replaceAll(/[\\/:*?"<>|]+/g, '_').slice(0, 60)
  const blob = new Blob([workflowJson], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${safe}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  // 稍后释放，避免部分浏览器还没开始下载就失效
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

export function CreateWithThis({ item }: { item: PromptGalleryItem }) {
  const { t } = useTranslation()
  const { config, loaded } = useGalleryCreateConfig()

  const anyEnabled =
    config.netdisk_download ||
    config.comfyui_node ||
    config.runninghub ||
    config.manual_workflow

  const payloadQuery = useQuery({
    queryKey: ['prompt-gallery', 'create', item.id],
    queryFn: async () => {
      const resp = await getGalleryCreatePayload(item.id)
      return resp.data
    },
    enabled: loaded && anyEnabled && item.id > 0,
    staleTime: 60 * 1000,
  })

  const payload = payloadQuery.data
  const netdiskSources = useMemo(
    () => (payload?.model_sources ?? []).filter(isNetdisk),
    [payload?.model_sources]
  )

  const hasWorkflow = Boolean(payload?.workflow_json?.trim())
  const hasRunningHub = Boolean(payload?.runninghub_workflow_id?.trim())

  const openComfyNode = useCallback(() => {
    // 新标签页打开本地 ComfyUI（导航不算混合内容，HTTPS 页面里也能跳）
    window.open(buildComfyNodeUrl(item.id), '_blank', 'noopener,noreferrer')
    toast.message(
      t('Opening your local ComfyUI…', {
        defaultValue: '正在打开本地 ComfyUI，请确认它已启动，且已安装 ymm-bridge 节点。',
      })
    )
  }, [item.id, t])

  const openRunningHub = useCallback(() => {
    if (!payload?.runninghub_workflow_id) return
    window.open(
      runningHubWorkflowUrl(payload.runninghub_workflow_id),
      '_blank',
      'noopener,noreferrer'
    )
  }, [payload?.runninghub_workflow_id])

  const handleDownloadWorkflow = useCallback(() => {
    if (!payload?.workflow_json) return
    downloadWorkflow(item.title, payload.workflow_json)
    toast.success(
      t('Workflow downloaded. Drag it into ComfyUI.', {
        defaultValue: '工作流已下载，拖进 ComfyUI 即可加载。',
      })
    )
  }, [item.title, payload?.workflow_json, t])

  // 开关还没读到 / 全关 → 整块不渲染，避免首屏闪一个空面板
  if (!loaded || !anyEnabled) return null

  const showNetdisk = config.netdisk_download && netdiskSources.length > 0
  const showNode = config.comfyui_node && hasWorkflow
  const showRunningHub = config.runninghub && hasRunningHub
  const showManual = config.manual_workflow && hasWorkflow
  const nothingToShow = !showNetdisk && !showNode && !showRunningHub && !showManual

  return (
    <section className='rounded-2xl border border-border/70 bg-muted/30 p-4'>
      <div className='mb-3 flex items-center gap-2'>
        <Wand2 className='size-4 text-primary' />
        <h2 className='text-sm font-semibold'>
          {t('Create with this', { defaultValue: '去创作' })}
        </h2>
        <span className='text-xs text-muted-foreground'>
          {t('Reuse this prompt, model and workflow', {
            defaultValue: '复用这条作品的提示词、模型与工作流',
          })}
        </span>
      </div>

      {payloadQuery.isLoading && (
        <div className='flex items-center gap-2 py-2 text-xs text-muted-foreground'>
          <Loader2 className='size-3.5 animate-spin' />
          {t('Loading…')}
        </div>
      )}

      {!payloadQuery.isLoading && nothingToShow && (
        <p className='text-xs text-muted-foreground'>
          {t(
            'This work has no reusable workflow or model info yet. You can still copy the prompt above.',
            { defaultValue: '这条作品暂未配置可复用的工作流/模型信息，可先复制上方的提示词使用。' }
          )}
        </p>
      )}

      {!payloadQuery.isLoading && !nothingToShow && (
        <div className='space-y-3'>
          <div className='flex flex-wrap gap-2'>
            {showNode && (
              <Button size='sm' className='gap-1.5 rounded-full' onClick={openComfyNode}>
                <Sparkles className='size-4' />
                {t('One-click in ComfyUI', { defaultValue: 'ComfyUI 一键生图' })}
              </Button>
            )}
            {showRunningHub && (
              <Button
                size='sm'
                variant='secondary'
                className='gap-1.5 rounded-full'
                onClick={openRunningHub}
              >
                <Cloud className='size-4' />
                {t('Run on RunningHub', { defaultValue: 'RunningHub 云端出图' })}
                <ExternalLink className='size-3 opacity-70' />
              </Button>
            )}
            {showManual && (
              <Button
                size='sm'
                variant='outline'
                className='gap-1.5 rounded-full'
                onClick={handleDownloadWorkflow}
              >
                <Download className='size-4' />
                {t('Download workflow', { defaultValue: '下载工作流 JSON' })}
              </Button>
            )}
          </div>

          {showNetdisk && (
            <div className='space-y-1.5'>
              <div className='flex items-center gap-1.5 text-xs font-medium text-muted-foreground'>
                <HardDriveDownload className='size-3.5' />
                {t('Models on netdisk', { defaultValue: '模型网盘下载' })}
              </div>
              <div className='flex flex-wrap gap-1.5'>
                {netdiskSources.map((source) => (
                  <a
                    key={`${source.name}-${source.url}`}
                    href={source.url}
                    target='_blank'
                    rel='noopener noreferrer'
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full border border-border',
                      'bg-background px-2.5 py-1 text-xs text-foreground/80',
                      'transition-colors hover:border-primary/50 hover:text-foreground'
                    )}
                  >
                    <ExternalLink className='size-3' />
                    {source.name || t('Model file', { defaultValue: '模型文件' })}
                  </a>
                ))}
              </div>
              <p className='text-[11px] text-muted-foreground'>
                {t(
                  'Download manually, then put the file into your ComfyUI models folder.',
                  { defaultValue: '点开手动下载，下载后放进 ComfyUI 的 models 对应目录。' }
                )}
              </p>
            </div>
          )}

          {showNode && (
            <p className='text-[11px] text-muted-foreground'>
              {t(
                'Requires the ymm-bridge node in your local ComfyUI and ComfyUI running at 127.0.0.1:8188.',
                {
                  defaultValue:
                    '需本地 ComfyUI 已安装 ymm-bridge 节点，且已在 127.0.0.1:8188 启动。',
                }
              )}{' '}
              <Link
                to={BRIDGE_PAGE_PATH}
                className='font-medium text-primary hover:underline'
              >
                {t('Install guide', { defaultValue: '安装说明' })}
              </Link>
            </p>
          )}
        </div>
      )}
    </section>
  )
}
