/*
 * 标题 + 品牌图标行 + 副标题（对齐 liblib：标题 36px/500，#191919；下方 6 个彩色圆标 + 说明）
 */
const BRANDS = [
  { from: '#C7B6FF', to: '#8B7BE8', icon: '✧' },
  { from: '#BBD3FF', to: '#7FA6F5', icon: '◆' },
  { from: '#FFCBA8', to: '#F09A6B', icon: '✎' },
  { from: '#A9E4FF', to: '#63B8E8', icon: '❋' },
  { from: '#C8F0D8', to: '#7BCB9B', icon: '▤' },
  { from: '#FFD3C4', to: '#F09272', icon: '◎' },
]

export function BrandStrip({ subtitle }: { subtitle: string }) {
  return (
    <div className='flex flex-wrap items-center justify-center gap-2'>
      <div className='flex items-center gap-1'>
        {BRANDS.map((b) => (
          <span
            key={b.icon}
            className='flex size-6 items-center justify-center rounded-full text-[11px] text-white/95'
            style={{
              backgroundImage: `linear-gradient(135deg, ${b.from}, ${b.to})`,
            }}
          >
            {b.icon}
          </span>
        ))}
      </div>
      <span className='text-foreground/80 text-sm'>{subtitle}</span>
    </div>
  )
}
