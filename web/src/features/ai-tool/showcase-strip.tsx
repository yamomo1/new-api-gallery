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

/** 横向滚动条：默认隐藏，这里显式给一条细的，否则用户不知道还能往右滑 */
const SCROLL_CLASS =
  '[scrollbar-width:thin] [scrollbar-color:rgba(0,0,0,0.18)_transparent] ' +
  'dark:[scrollbar-color:rgba(255,255,255,0.22)_transparent] ' +
  '[&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent ' +
  '[&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-black/15 ' +
  'dark:[&::-webkit-scrollbar-thumb]:bg-white/20'

export function ShowcaseStrip({
  items,
  moreHref = '/prompt-gallery',
  compact = false,
}: {
  items: ShowcaseItem[]
  moreHref?: string
  /**
   * 矮版：出结果后把空间让给上方结果区。
   * 位置不变（仍固定在下、输入卡之上），只是卡片小一号 —— 否则 900 高的窗口下
   * 作品条吃掉近 300px，结果区只剩 250px，一张方图都看不全。
   */
  compact?: boolean
}) {
  const cardClass = compact
    ? 'h-[132px] w-[100px] rounded-[10px]'
    : 'h-[236px] w-[178px] rounded-[14px]'
  const titleClass = compact
    ? 'text-[11px] leading-[1.35]'
    : 'text-[13px] leading-[1.5]'
  const overlayClass = compact ? 'px-2 pt-5 pb-2' : 'px-3 pt-8 pb-3'

  return (
    <section className='w-full'>
      {/* 横向滚动：可见细滚动条 + 两端可完整滑到位，最后一张不会被容器边缘切掉 */}
      <div
        className={
          'flex overflow-x-auto pb-2 ' +
          (compact ? 'gap-3 ' : 'gap-5 ') +
          SCROLL_CLASS
        }
      >
        {items.map((it) => (
          <article
            key={it.id}
            className={
              'relative shrink-0 overflow-hidden transition-transform duration-200 hover:-translate-y-1 ' +
              cardClass
            }
            style={{
              backgroundImage: `linear-gradient(160deg, ${it.from}, ${it.to})`,
            }}
          >
            <div
              className={
                'absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent ' +
                overlayClass
              }
            >
              <p
                className={
                  'line-clamp-2 font-medium text-white/95 ' + titleClass
                }
              >
                {it.title}
              </p>
            </div>
            <span className='absolute top-2 right-2 rounded-[5px] bg-white/20 px-1.5 py-0.5 text-[10px] font-semibold text-white/90 backdrop-blur-sm'>
              AI
            </span>
          </article>
        ))}
      </div>

      {/* 「查看更多」放在卡片下方、右对齐 —— 用户明确要求沉到最底下 */}
      <div
        className={compact ? 'mt-1 flex justify-end' : 'mt-2 flex justify-end'}
      >
        <a
          href={moreHref}
          className='text-muted-foreground hover:text-foreground flex items-center gap-0.5 text-[14px]'
        >
          查看更多
          <ChevronRight className='size-4' />
        </a>
      </div>
    </section>
  )
}
