import {
  CloudDownload,
  FolderDown,
  Lock,
  Play,
  ScanSearch,
  Timer,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

type Copy = {
  /** i18n key（英文），defaultValue 为中文 */
  titleKey: string
  title: string
  bodyKey: string
  body: string
  icon: LucideIcon
}

const STEPS: Copy[] = [
  {
    titleKey: 'Reads the work ID',
    title: '读到作品 ID',
    bodyKey: 'Reads the work ID body',
    body: '「一键生图」在新标签页打开 127.0.0.1:8188 并带上作品 ID 与站点地址，节点自带的前端扩展读这两个参数。',
    icon: ScanSearch,
  },
  {
    titleKey: 'Pulls the workflow',
    title: '拉取工作流',
    bodyKey: 'Pulls the workflow body',
    body: '扩展请求节点的本地接口 /ymm/payload，由 Python 侧去站点取数据，绕开浏览器的跨域限制。',
    icon: CloudDownload,
  },
  {
    titleKey: 'Fills in missing models',
    title: '补齐缺失模型',
    bodyKey: 'Fills in missing models body',
    body: '把没有的模型流式写进 ComfyUI 的 models/<dir>/，已有的直接跳过；配了 sha256 的会校验内容。',
    icon: FolderDown,
  },
  {
    titleKey: 'Loads the graph and queues',
    title: '还原画布并排队',
    bodyKey: 'Loads the graph and queues body',
    body: '用 loadGraphData 把节点图铺回画布，再 queuePrompt 自动排队。剩下的就是等你的显卡出图。',
    icon: Play,
  },
]

const GUARANTEES: Copy[] = [
  {
    titleKey: 'Only downloads what is missing',
    title: '只下你没有的',
    bodyKey: 'Only downloads what is missing body',
    body: '同名且非空的模型文件直接跳过。你硬盘上已有十几个 G 的底模，不会因为点了一次「一键生图」就再下一遍。',
    icon: Timer,
  },
  {
    titleKey: 'No half-written files',
    title: '不留半截文件',
    bodyKey: 'No half-written files body',
    body: '下载先写 .part 临时文件，完整落盘后才改名。中途断网或关掉 ComfyUI，也不会留下一个看着像模型、实际打不开的坏文件。',
    icon: ShieldCheck,
  },
  {
    titleKey: 'Nothing leaves your machine',
    title: '不出你的机器',
    bodyKey: 'Nothing leaves your machine body',
    body: '只有两件事联网：取作品数据、下模型文件。节点不上报你的显卡型号、模型清单或生成结果，出图全程在本机。',
    icon: Lock,
  },
]

function CopyBlock({ item }: { item: Copy }) {
  const { t } = useTranslation()
  return (
    <>
      <item.icon className='mt-4 size-5 text-primary' />
      <h3 className='mt-3 text-[15px] font-medium'>
        {t(item.titleKey, { defaultValue: item.title })}
      </h3>
      <p className='mt-1.5 text-[13px] leading-[1.7] text-muted-foreground'>
        {t(item.bodyKey, { defaultValue: item.body })}
      </p>
    </>
  )
}

export function BridgePipeline() {
  const { t } = useTranslation()

  return (
    <div className='space-y-14'>
      <section>
        <h2 className='text-[1.4rem] font-semibold tracking-[-0.01em] md:text-2xl'>
          {t('What it does for you', { defaultValue: '它替你做了什么' })}
        </h2>
        <p className='mt-2 max-w-2xl text-[14px] leading-relaxed text-muted-foreground'>
          {t(
            'Four steps, one click. You never assemble the graph by hand or hunt for a checkpoint again.',
            {
              defaultValue:
                '四步，全程自动。不用自己连线，也不用再去论坛翻某个底模的下载地址。',
            }
          )}
        </p>

        <ol className='mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6'>
          {STEPS.map((step, index) => (
            <li key={step.titleKey}>
              <div className='flex items-center gap-2'>
                <span className='font-mono text-[11px] text-muted-foreground'>
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className='h-px flex-1 bg-border' />
              </div>
              <CopyBlock item={step} />
            </li>
          ))}
        </ol>
      </section>

      <section>
        <h2 className='text-[1.4rem] font-semibold tracking-[-0.01em] md:text-2xl'>
          {t('Built for people who already have models', {
            defaultValue: '给已经有模型的人用的',
          })}
        </h2>
        <div className='mt-6 grid gap-px overflow-hidden rounded-xl border border-border/70 bg-border/70 sm:grid-cols-3'>
          {GUARANTEES.map((item) => (
            <div key={item.titleKey} className='bg-background p-5'>
              <CopyBlock item={item} />
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
