/*
 * 底部作品横滑条（右对齐「查看更多 ›」+ 大尺寸圆角卡片）
 * 目标站是真实作品；本阶段 UI 还原用渐变色封面占位，后续接画廊数据替换 cover 即可。
 */
import { ChevronRight } from 'lucide-react'

export type ShowcaseItem = {
  id: string
  title: string
  from: string
  to: string
}

export function ShowcaseStrip({
  items,
  moreHref = '/prompt-gallery',
}: {
  items: ShowcaseItem[]
  moreHref?: string
}) {
  return (
    <section className='w-full'>
      <div className='mb-4 flex justify-end'>
        <a
          href={moreHref}
          className='text-muted-foreground hover:text-foreground flex items-center gap-0.5 text-[14px]'
        >
          查看更多
          <ChevronRight className='size-4' />
        </a>
      </div>
      <div className='scrollbar-none flex gap-5 overflow-x-auto pb-1'>
        {items.map((it) => (
          <article
            key={it.id}
            className='relative h-[236px] w-[178px] shrink-0 overflow-hidden rounded-[14px] transition-transform duration-200 hover:-translate-y-1'
            style={{ backgroundImage: `linear-gradient(160deg, ${it.from}, ${it.to})` }}
          >
            <div className='absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent px-3 pt-8 pb-3'>
              <p className='line-clamp-2 text-[13px] leading-[1.5] font-medium text-white/95'>
                {it.title}
              </p>
            </div>
            <span className='absolute top-2 right-2 rounded-[5px] bg-white/20 px-1.5 py-0.5 text-[10px] font-semibold text-white/90 backdrop-blur-sm'>
              AI
            </span>
          </article>
        ))}
      </div>
    </section>
  )
}
