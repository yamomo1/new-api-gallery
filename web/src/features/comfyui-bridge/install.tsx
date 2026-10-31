import { Link } from '@tanstack/react-router'
import { Download, ExternalLink, Info } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import { CodeBlock } from './code-block'
import {
  BRIDGE_VERSION,
  BRIDGE_ZIP_SIZE,
  BRIDGE_ZIP_URL,
  COMFY_PORT,
  CREATE_BUTTON_LABEL,
  CUSTOM_NODES_PATH,
  GALLERY_PATH,
} from './config'

const LOADED_LOG = `[ymm-bridge] loaded · 1 web extension`

const OPENED_URL = `http://127.0.0.1:${COMFY_PORT}/?ymm_gallery=128&ymm_site=https://cdymm.com`

const LIMITS: { key: string; label: string; value: string }[] = [
  {
    key: 'port',
    label: 'ComfyUI 端口',
    value:
      '需要是默认的 8188。「去创作」打开的地址写死了这个端口，改成别的端口就连不上。',
  },
  {
    key: 'deps',
    label: '依赖',
    value: '只用 Python 标准库和 ComfyUI 自带的 aiohttp，不需要 pip install 任何东西。',
  },
  {
    key: 'workflow',
    label: '工作流格式',
    value:
      '作品里配的工作流必须是 ComfyUI「保存」出来的 UI 格式（含 nodes / links），API 格式还原不了画布。',
  },
  {
    key: 'netdisk',
    label: '网盘来源',
    value:
      '夸克、百度等网盘链接不会自动下载（需要登录态且限速），会在详情页给你链接手动取；其余直链才自动下。',
  },
  {
    key: 'browser',
    label: '浏览器',
    value:
      '部分浏览器会对页面跳转到 127.0.0.1 弹确认，允许后即可；建议用 Chrome / Edge。',
  },
  {
    key: 'disk',
    label: '磁盘占用',
    value: '按作品配置的模型而定，单个底模常见 2-12 GB，下载前请留足空间。',
  },
]

function StepShell({
  index,
  title,
  children,
}: {
  index: number
  title: string
  children: React.ReactNode
}) {
  return (
    <li className='grid gap-4 sm:grid-cols-[56px_minmax(0,1fr)] sm:gap-6'>
      <div className='font-mono text-[26px] leading-none text-muted-foreground/40 tabular-nums'>
        {String(index).padStart(2, '0')}
      </div>
      <div className='min-w-0 space-y-3'>
        <h3 className='text-[15px] font-medium'>{title}</h3>
        {children}
      </div>
    </li>
  )
}

export function BridgeInstall() {
  const { t } = useTranslation()

  return (
    <section id='install' className='scroll-mt-24'>
      <h2 className='text-[1.4rem] font-semibold tracking-[-0.01em] md:text-2xl'>
        {t('Three steps to install', { defaultValue: '三步装好' })}
      </h2>
      <p className='mt-2 max-w-2xl text-[14px] leading-relaxed text-muted-foreground'>
        {t(
          'Copy the folder, restart ComfyUI, done. No node graph editing, no config file.',
          {
            defaultValue:
              '放一个文件夹，重启一次 ComfyUI，就这样。不用改节点图，也不用写配置文件。',
          }
        )}
      </p>

      <ol className='mt-8 space-y-10'>
        <StepShell
          index={1}
          title={t('Unzip into custom_nodes', {
            defaultValue: '解压到 custom_nodes',
          })}
        >
          <p className='text-[13px] leading-[1.7] text-muted-foreground'>
            {t(
              'Download the zip and put the extracted folder here. The final layout matters: __init__.py must sit directly inside it.',
              {
                defaultValue:
                  '下载压缩包，把解压出来的整个文件夹放到下面这个位置。层级别弄错：__init__.py 要直接在这一层。',
              }
            )}
          </p>
          <a
            href={BRIDGE_ZIP_URL}
            download
            className={cn(
              buttonVariants({ variant: 'outline', size: 'lg' }),
              'h-10 gap-2 rounded-lg px-3.5 text-[14px]'
            )}
          >
            <Download className='size-4' />
            {t('Download node', { defaultValue: '下载节点' })}
            <span className='font-mono text-[11px] text-muted-foreground'>
              v{BRIDGE_VERSION} · {BRIDGE_ZIP_SIZE}
            </span>
          </a>
          <CodeBlock label='path' code={CUSTOM_NODES_PATH} />
        </StepShell>

        <StepShell
          index={2}
          title={t('Restart ComfyUI', { defaultValue: '重启 ComfyUI' })}
        >
          <p className='text-[13px] leading-[1.7] text-muted-foreground'>
            {t('Startup log prints this line once the node is picked up.', {
              defaultValue: '启动日志里打印出下面这一行，就说明节点已经加载上了。',
            })}
          </p>
          <CodeBlock label='startup log' code={LOADED_LOG} />
        </StepShell>

        <StepShell
          index={3}
          title={t('Open a work and click the button', {
            defaultValue: '打开一条作品，点按钮',
          })}
        >
          <p className='text-[13px] leading-[1.7] text-muted-foreground'>
            {t(
              'Every work page now shows a "Create with this" block. Click it and the node takes over — you do not type any address yourself.',
              {
                defaultValue: `作品详情页底部有「去创作」区块，点「${CREATE_BUTTON_LABEL}」后节点接管，地址不用你自己拼。`,
              }
            )}
          </p>
          <CodeBlock label='opened automatically' code={OPENED_URL} />
          <Link
            to={GALLERY_PATH}
            className='inline-flex items-center gap-1 text-[13px] text-primary hover:underline'
          >
            {t('Pick a work in the gallery', {
              defaultValue: '去画廊挑一条作品',
            })}
            <ExternalLink className='size-3.5' />
          </Link>
        </StepShell>
      </ol>

      <div className='mt-12'>
        <h3 className='flex items-center gap-1.5 text-[14px] font-medium'>
          <Info className='size-4 text-muted-foreground' />
          {t('Compatibility and limits', { defaultValue: '兼容与限制' })}
        </h3>
        <dl className='mt-3 divide-y divide-border/70 overflow-hidden rounded-xl border border-border/70'>
          {LIMITS.map((item) => (
            <div
              key={item.key}
              className='grid gap-1 px-5 py-3.5 sm:grid-cols-[132px_minmax(0,1fr)] sm:gap-4'
            >
              <dt className='text-[13px] font-medium'>
                {t(`limit.${item.key}`, { defaultValue: item.label })}
              </dt>
              <dd className='text-[13px] leading-[1.65] text-muted-foreground'>
                {t(`limit.${item.key}.value`, { defaultValue: item.value })}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}
