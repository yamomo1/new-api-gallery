import { Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { BRIDGE_DIR_NAME, COMFY_PORT } from './config'

type Faq = {
  key: string
  q: string
  a: string
}

const FAQS: Faq[] = [
  {
    key: 'where',
    q: '模型会被下到哪里？',
    a: `落在 ComfyUI 的 models/<dir>/ 下，dir 由作品配置决定（checkpoints、loras、vae、controlnet 等），和 ComfyUI 自己的模型目录是同一套，下完在模型下拉里直接能选到。`,
  },
  {
    key: 'duplicate',
    q: '我已有的模型会不会被重复下一份？',
    a: '不会。同名且非空的文件直接跳过。前提是文件名要与作品里配置的一致——如果你自己改过名，节点认不出来，会当成缺失再下一份。',
  },
  {
    key: 'nothing',
    q: '点了按钮没反应 / 页面打不开？',
    a: `按顺序查三件事：一、ComfyUI 是不是在 ${COMFY_PORT} 端口启动着；二、启动日志里有没有 [ymm-bridge] loaded 这一行；三、浏览器是否拦了跳转到 127.0.0.1 的请求，允许后重试。`,
  },
  {
    key: 'privacy',
    q: '我的显卡型号和模型清单会被上传吗？',
    a: '不会。节点只做两件联网的事：向站点取作品数据、按作品给出的地址下载模型。它不上报硬件信息，生成结果也不经过我们的服务器。',
  },
  {
    key: 'missing',
    q: '为什么有些作品没有「一键生图」？',
    a: '那条作品还没配工作流，或者站长把该入口关掉了。这种情况下可以改用「下载工作流 JSON」，把文件拖进 ComfyUI 手动加载。',
  },
  {
    key: 'conflict',
    q: '会不会影响我现有的 ComfyUI？',
    a: '它不注册任何可连线的节点，不会往你的节点菜单里加东西；只在 ComfyUI 里挂了两个本地接口（/ymm/payload、/ymm/download）和一段前端扩展。',
  },
  {
    key: 'uninstall',
    q: '怎么卸载？',
    a: `删掉 custom_nodes/${BRIDGE_DIR_NAME}/ 整个目录，重启 ComfyUI 即可。已经下好的模型和你自己的工作流都不受影响。`,
  },
]

export function BridgeFaq() {
  const { t } = useTranslation()

  return (
    <section>
      <h2 className='text-[1.4rem] font-semibold tracking-[-0.01em] md:text-2xl'>
        {t('Questions people actually ask', { defaultValue: '常见问题' })}
      </h2>
      <div className='mt-5 border-t border-border/70'>
        {FAQS.map((faq) => (
          <details key={faq.key} className='group border-b border-border/70 py-4'>
            <summary className='flex cursor-pointer list-none items-center justify-between gap-4 text-[14px] font-medium marker:content-none [&::-webkit-details-marker]:hidden'>
              {t(`faq.${faq.key}`, { defaultValue: faq.q })}
              <Plus className='size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-45' />
            </summary>
            <p className='mt-2 pr-8 text-[13px] leading-[1.75] text-muted-foreground'>
              {t(`faq.${faq.key}.a`, { defaultValue: faq.a })}
            </p>
          </details>
        ))}
      </div>
    </section>
  )
}
