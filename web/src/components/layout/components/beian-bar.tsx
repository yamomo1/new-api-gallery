/**
 * 全站备案信息条（中国大陆合规）
 * ------------------------------------------------------------------
 * 为什么放在这里：电影感画廊首页（features/gallery-home）自行渲染全部区块、
 * 没有页脚；官方首页 features/home 里的 <Footer/> 在「首页已替换为画廊」时
 * 不被任何路由引用，会被 tree-shaking 删掉，导致页脚备案不显示。
 * 因此把备案条挂到根布局 __root.tsx（每个页面都必经），保证任意页面底部
 * 都显示、且一定被打进产物。
 *
 * 合规：ICP 备案号须带下划线并链接到工信部备案系统，点击即可查询/核验。
 * 改备案只改下方 BEIAN 一处。
 */

const BEIAN = {
  company: '成都亚默默科技有限公司',
  icp: '蜀ICP备18009444号-1',
  icpHref: 'https://beian.miit.gov.cn/',
}

export function BeianBar() {
  return (
    <div className='border-border/40 text-muted-foreground/45 flex flex-col items-center gap-1 border-t px-6 py-4 text-center text-xs leading-relaxed'>
      <span className='text-muted-foreground/60'>{BEIAN.company}</span>
      <a
        href={BEIAN.icpHref}
        target='_blank'
        rel='noopener noreferrer'
        title='点击到工信部备案系统查询该备案'
        className='text-muted-foreground/60 underline decoration-dotted underline-offset-2 transition-colors duration-200 hover:text-foreground'
      >
        {BEIAN.icp}
      </a>
    </div>
  )
}
