import { Link } from '@tanstack/react-router'
import { ArrowRight, Download } from 'lucide-react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import { PublicLayout } from '@/components/layout'
import { PageTransition } from '@/components/page-transition'
import { buttonVariants } from '@/components/ui/button'
import { applySeoForPath, loadSeoConfig } from '@/lib/seo'
import { cn } from '@/lib/utils'

import {
  BRIDGE_PAGE_PATH,
  BRIDGE_ZIP_SIZE,
  BRIDGE_ZIP_URL,
  GALLERY_PATH,
} from './config'
import { BridgeFaq } from './faq'
import { BridgeHero } from './hero'
import { BridgeInstall } from './install'
import { BridgePipeline } from './pipeline'

/**
 * ymm-bridge 落地页（/comfyui）
 * ------------------------------------------------------------------
 * 客户从「去创作」点「ComfyUI 一键生图」失败后，最需要的是一个能看懂、
 * 能直接下载、能自己排错的落地页。所以这一页只做三件事：
 * 说清它是干什么的、给一个真实可用的下载、把装不上的常见原因列出来。
 *
 * 首屏 head 由 Go 侧 service/seo 注入（Pages["/comfyui"]）；
 * 这里只处理客户端路由跳转时的同步。
 */
export function ComfyUIBridgeLanding() {
  const { t } = useTranslation()

  useEffect(() => {
    void loadSeoConfig().then((cfg) => {
      if (cfg) applySeoForPath(cfg, BRIDGE_PAGE_PATH)
    })
  }, [])

  return (
    <PublicLayout>
      <PageTransition>
        <div className='mx-auto w-full max-w-6xl pb-16'>
          <BridgeHero />

          <div className='mt-20 space-y-20 md:mt-28 md:space-y-24'>
            <BridgePipeline />
            <BridgeInstall />
            <BridgeFaq />

            <section className='rounded-2xl border border-border/70 bg-muted/30 px-6 py-8 md:px-10 md:py-10'>
              <div className='flex flex-col items-start justify-between gap-6 md:flex-row md:items-center'>
                <div>
                  <h2 className='text-[1.25rem] font-semibold md:text-[1.4rem]'>
                    {t('Installed? Go try one', {
                      defaultValue: '装好了？去挑一张图试试',
                    })}
                  </h2>
                  <p className='mt-1.5 max-w-lg text-[13.5px] leading-relaxed text-muted-foreground'>
                    {t(
                      'Open any work, hit "One-click in ComfyUI" under Create with this. It prepares the models and the canvas for you.',
                      {
                        defaultValue:
                          '打开任意一条作品，在「去创作」里点「ComfyUI 一键生图」——模型和画布它都会自己准备好。',
                      }
                    )}
                  </p>
                </div>
                <div className='flex shrink-0 flex-wrap items-center gap-2'>
                  <Link
                    to={GALLERY_PATH}
                    className={cn(
                      buttonVariants({ size: 'lg' }),
                      'h-10 gap-1.5 rounded-lg px-4 text-[14px]'
                    )}
                  >
                    {t('Open gallery', { defaultValue: '去画廊' })}
                    <ArrowRight className='size-4' />
                  </Link>
                  <a
                    href={BRIDGE_ZIP_URL}
                    download
                    className={cn(
                      buttonVariants({ variant: 'outline', size: 'lg' }),
                      'h-10 gap-1.5 rounded-lg px-4 text-[14px]'
                    )}
                  >
                    <Download className='size-4' />
                    {t('Download again', { defaultValue: '重新下载' })}
                    <span className='font-mono text-[11px] text-muted-foreground'>
                      {BRIDGE_ZIP_SIZE}
                    </span>
                  </a>
                </div>
              </div>
            </section>

            <p className='text-center text-[12px] text-muted-foreground'>
              {t(
                'ymm-bridge is a local helper for ComfyUI. It is not required for browsing or downloading prompts.',
                {
                  defaultValue:
                    'ymm-bridge 是给 ComfyUI 用的本地辅助节点；浏览和复制提示词不需要安装它。',
                }
              )}
            </p>
          </div>
        </div>
      </PageTransition>
    </PublicLayout>
  )
}
