/**
 * 全站备案信息条（中国大陆合规）
 * ------------------------------------------------------------------
 * 为什么放在这里：电影感画廊首页（features/gallery-home）自行渲染全部区块、
 * 没有页脚；官方首页 features/home 里的 <Footer/> 在「首页已替换为画廊」时
 * 不被任何路由引用，会被 tree-shaking 删掉，导致页脚备案不显示。
 * 因此把备案条挂到根布局 __root.tsx（每个页面都必经），保证任意页面底部
 * 都显示、且一定被打进产物。
 *
 * 设计语言：与电影感画廊同源——恒深绿黑品牌底（同 hero/CTA 的 --hero-screen）
 * ＋ 顶部居中渐隐金色发丝线 ＋ 金色菱形点（呼应 ModelTicker 的菱形）＋ Lora
 * 衬线公司名 ＋ 可点查工信部系统的备案号。不是默认灰条，而是整段电影体验的「落幕」。
 *
 * 合规：ICP 备案号须带下划线并链接到工信部备案系统，点击即可查询/核验。
 * 改备案只改下方 BEIAN 一处。
 */
const BEIAN = {
  company: '成都亚默默科技有限公司',
  icp: '蜀ICP备18009444号-1',
  icpHref: 'https://beian.miit.gov.cn/',
}

// 画廊品牌色（与 gallery-home.css 的 --hero-screen / --hero-gold 对齐，
// 恒深色、不随主题——和 hero / CTA 面板一致，浅色页面上也像个深色品牌收尾）
const INK = 'rgba(245, 241, 232, '

export function BeianBar() {
  return (
    <footer
      className='relative z-0 overflow-hidden'
      style={{
        background:
          'radial-gradient(62% 130% at 50% -45%, rgba(247,191,119,0.10), transparent 62%), linear-gradient(180deg, #060d10 0%, #04080b 100%)',
        color: INK + '0.78)',
        fontFamily: 'var(--font-sans)',
      }}
    >
      {/* 顶部金色发丝线：居中渐隐，像幕布的一道光 */}
      <div
        aria-hidden
        style={{
          height: 1,
          background:
            'linear-gradient(90deg, transparent 6%, rgba(247,191,119,0.55) 50%, transparent 94%)',
        }}
      />

      <div className='mx-auto flex max-w-[1200px] flex-col items-center gap-2 px-6 py-5 sm:flex-row sm:justify-center sm:gap-x-5 sm:gap-y-0'>
        {/* 品牌签章：金色菱形点（呼应 ModelTicker 的菱形）＋ Lora 衬线公司名 */}
        <div className='flex items-center gap-2.5'>
          <span
            aria-hidden
            style={{
              width: 7,
              height: 7,
              transform: 'rotate(45deg)',
              background: 'linear-gradient(135deg, #f6d29a, #e2a056)',
              borderRadius: 1.5,
              boxShadow: '0 0 10px rgba(247,191,119,0.5)',
              flex: 'none',
            }}
          />
          <span
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: 13,
              letterSpacing: '0.06em',
              color: INK + '0.78)',
              whiteSpace: 'nowrap',
            }}
          >
            {BEIAN.company}
          </span>
        </div>

        {/* 桌面端金色发丝分隔 */}
        <span
          aria-hidden
          className='hidden sm:block'
          style={{
            width: 34,
            height: 1,
            background:
              'linear-gradient(90deg, transparent, rgba(247,191,119,0.4), transparent)',
          }}
        />

        {/* 备案号：带下划线（合规必需），点击直达工信部备案系统查询。
            全静态类名，hover 把下划线/文字从暖白切到金色 */}
        <a
          href={BEIAN.icpHref}
          target='_blank'
          rel='noopener noreferrer'
          title='点击到工信部备案系统查询该备案'
          className='transition-colors duration-200 underline decoration-dotted underline-offset-[3px] decoration-[rgba(245,241,232,0.35)] text-[rgba(245,241,232,0.5)] hover:decoration-[#f7bf77] hover:text-[#f7bf77]'
          style={{ fontSize: 12, letterSpacing: '0.03em', whiteSpace: 'nowrap' }}
        >
          {BEIAN.icp}
        </a>
      </div>
    </footer>
  )
}
