import { Link } from '@tanstack/react-router'
import {
  ArrowDown,
  Download,
  HardDrive,
  MonitorSmartphone,
  PackageCheck,
  Sparkles,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import {
  BRIDGE_VERSION,
  BRIDGE_ZIP_SIZE,
  BRIDGE_ZIP_URL,
  COMFY_PORT,
  GALLERY_PATH,
} from './config'

/**
 * 节点加载后控制台里的真实动作序列。
 * 「示意输出」——文案里已注明实际内容随作品而异，不假装是真实截图。
 */
type LogTone = 'dim' | 'plain' | 'ok' | 'accent'

const LOG_LINES: { id: string; text: string; tone: LogTone }[] = [
  { id: 'vram', text: 'Total VRAM 24564 MB · device cuda:0', tone: 'dim' },
  { id: 'loaded', text: '[ymm-bridge] loaded · 1 web extension', tone: 'ok' },
  { id: 'blank', text: '', tone: 'dim' },
  { id: 'open', text: '# browser opened ?ymm_gallery=128', tone: 'dim' },
  { id: 'payload', text: '[ymm] payload <- gallery #128', tone: 'plain' },
  { id: 'graph', text: '[ymm] workflow: 24 nodes / 31 links', tone: 'plain' },
  { id: 'check', text: '[ymm] models: 2 missing / 3 present', tone: 'accent' },
  { id: 'pull', text: '[ymm] download flux1-dev-fp8.safetensors (11.9 GB)', tone: 'accent' },
  { id: 'skip', text: '[ymm] skip  lora_ink_style.safetensors (exists)', tone: 'dim' },
  { id: 'canvas', text: '[ymm] loadGraphData -> canvas ready', tone: 'ok' },
  { id: 'queue', text: '[ymm] queuePrompt  -> job 4821', tone: 'ok' },
]

const TONE_CLASS: Record<LogTone, string> = {
  dim: 'text-neutral-500',
  plain: 'text-neutral-300',
  ok: 'text-emerald-400',
  accent: 'text-sky-400',
}

function LogPanel() {
  const { t } = useTranslation()

  return (
    <div className='overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950'>
      <div className='flex items-center gap-2 border-b border-neutral-800 px-4 py-2.5'>
        <span className='size-2.5 rounded-full bg-neutral-700' />
        <span className='size-2.5 rounded-full bg-neutral-700' />
        <span className='size-2.5 rounded-full bg-neutral-700' />
        <span className='ml-2 font-mono text-[11px] text-neutral-500'>
          comfyui · console
        </span>
      </div>
      <div className='space-y-1 px-4 py-4 font-mono text-[12px] leading-relaxed md:text-[12.5px]'>
        {LOG_LINES.map((line) => (
          <p key={line.id} className={cn('truncate', TONE_CLASS[line.tone])}>
            {line.text || '\u00a0'}
          </p>
        ))}
        <p className='text-neutral-600'>
          <span className='animate-pulse'>_</span>
        </p>
      </div>
      <p className='border-t border-neutral-800 px-4 py-2 text-[11px] text-neutral-600'>
        {t('Illustrative output. Actual lines depend on the work you open.', {
          defaultValue: '示意输出，实际内容随你打开的作品而异。',
        })}
      </p>
    </div>
  )
}

export function BridgeHero() {
  const { t } = useTranslation()

  return (
    <section className='grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.86fr)] lg:gap-14'>
      <div>
        <div className='inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-muted/50 px-2.5 py-1 text-[12px] text-muted-foreground'>
          <Sparkles className='size-3.5 text-primary' />
          {t('ComfyUI custom node · free and open', {
            defaultValue: 'ComfyUI 自定义节点 · 免费',
          })}
        </div>

        <h1 className='mt-5 text-[2rem] leading-[1.18] font-semibold tracking-[-0.02em] md:text-[2.9rem] md:leading-[1.12]'>
          {t('Move gallery works into your own ComfyUI in one click', {
            defaultValue: '把画廊里的作品，一键搬进你本地的 ComfyUI',
          })}
        </h1>

        <p className='mt-5 max-w-xl text-[15px] leading-[1.75] text-muted-foreground md:text-base'>
          {t(
            'See a look you like on cdymm.com, click "One-click in ComfyUI". The node pulls the workflow, downloads whatever models you are missing, restores the graph on your canvas and queues the job. Models land on your own disk, inference runs on your own GPU.',
            {
              defaultValue:
                '在 一幕AI 看到喜欢的图，点「ComfyUI 一键生图」：节点自动拉取工作流、下载缺失的模型、把节点图还原到画布上并排队出图。模型存在你自己的硬盘，出图跑在你自己的显卡。',
            }
          )}
        </p>

        <div className='mt-8 flex flex-wrap items-center gap-3'>
          <a
            href={BRIDGE_ZIP_URL}
            download
            className={cn(
              buttonVariants({ size: 'lg' }),
              'h-11 gap-2 rounded-xl px-4 text-[15px]'
            )}
          >
            <Download className='size-4' />
            {t('Download node', { defaultValue: '下载节点' })}
            <span className='ml-1 rounded-md bg-primary-foreground/20 px-1.5 py-0.5 font-mono text-[11px] font-normal'>
              v{BRIDGE_VERSION} · {BRIDGE_ZIP_SIZE}
            </span>
          </a>
          <a
            href='#install'
            className={cn(
              buttonVariants({ variant: 'outline', size: 'lg' }),
              'h-11 gap-2 rounded-xl px-4 text-[15px]'
            )}
          >
            {t('Install in 3 steps', { defaultValue: '三步装好' })}
            <ArrowDown className='size-4' />
          </a>
        </div>

        <Link
          to={GALLERY_PATH}
          className='mt-4 inline-flex items-center gap-1 text-[13px] text-primary hover:underline'
        >
          {t('Browse the gallery first', { defaultValue: '先去画廊挑一张' })}
          <span aria-hidden='true'>-&gt;</span>
        </Link>

        <ul className='mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-muted-foreground'>
          <li className='flex items-center gap-1.5'>
            <PackageCheck className='size-3.5' />
            {t('No pip install needed', { defaultValue: '无需 pip 安装' })}
          </li>
          <li className='flex items-center gap-1.5'>
            <MonitorSmartphone className='size-3.5' />
            {t('Windows / macOS / Linux', {
              defaultValue: 'Windows / macOS / Linux',
            })}
          </li>
          <li className='flex items-center gap-1.5'>
            <HardDrive className='size-3.5' />
            {t('Models stay on your own disk', {
              defaultValue: '模型留在你自己的硬盘',
            })}
          </li>
        </ul>
      </div>

      <div className='relative'>
        <p className='mb-2 font-mono text-[11px] tracking-wide text-muted-foreground uppercase'>
          {t('What it does inside ComfyUI', {
            defaultValue: '它在 ComfyUI 里做的事',
          })}
        </p>
        <LogPanel />
        <p className='mt-2 font-mono text-[11px] text-muted-foreground'>
          {`http://127.0.0.1:${COMFY_PORT}`}
        </p>
      </div>
    </section>
  )
}
