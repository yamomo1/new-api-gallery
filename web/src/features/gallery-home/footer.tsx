/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

/**
 * SiteFooter —— 全站页脚（布局对标 aliyun.com 2025）
 * ------------------------------------------------------------------
 * 挂在根布局 __root.tsx（替代原 BeianBar 的位置）：每个页面底部都有，
 * 备案信息（公司名 + ICP 号）整合进页脚最底部一行，点击 ICP 号可查工信部。
 *
 * 结构：多栏导航（栏目标题 + 链接）+ 右侧「关于我们」块
 *      → 分隔线 → 法律声明行 → 版权行 → 备案行
 *
 * 内容来自 HomeConfig.footer（后台「二开设置 → 首页设置 → 页脚」可编辑），
 * 组件内部自己拉配置（与首页同一套层级解析），没配置时走内置默认值。
 */
import { Link as TanstackLink } from '@tanstack/react-router'

import { useSiteFooter } from './api'
import './site-footer.css'

type FooterLink = { label: string; href: string }

const isExternal = (href: string) => /^https?:\/\//i.test(href)

function FooterLinkItem({ item }: { item: FooterLink }) {
  if (isExternal(item.href)) {
    return (
      <a
        className='site-footer-link'
        href={item.href}
        target='_blank'
        rel='noreferrer'
      >
        {item.label}
      </a>
    )
  }
  return (
    <TanstackLink className='site-footer-link' to={item.href}>
      {item.label}
    </TanstackLink>
  )
}

export function SiteFooter() {
  const data = useSiteFooter()
  if (!data || data.enabled === false) return null

  const columns = (data.columns ?? []).filter(
    (c) => c.title || (c.items && c.items.length > 0),
  )
  const legal = data.legal ?? []
  const about = data.about
  const beian = data.beian

  return (
    <footer className='site-footer'>
      <div className='site-footer-main'>
        <nav className='site-footer-cols' aria-label='Footer'>
          {columns.map((col, i) => (
            <div className='site-footer-col' key={i}>
              {col.title && (
                <h3 className='site-footer-col-title'>{col.title}</h3>
              )}
              {!!col.items?.length && (
                <ul>
                  {col.items.map((it, j) => (
                    <li key={j}>
                      <FooterLinkItem item={it} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}

          {about && (about.desc || about.contact) && (
            <div className='site-footer-col site-footer-about'>
              <h3 className='site-footer-col-title'>
                {about.title ?? 'About us'}
              </h3>
              {about.desc && <p className='site-footer-about-desc'>{about.desc}</p>}
              {about.contact && (
                <p className='site-footer-about-contact'>{about.contact}</p>
              )}
            </div>
          )}
        </nav>
      </div>

      {(legal.length > 0 || data.copyright || beian) && (
        <div className='site-footer-bottom'>
          <div className='site-footer-bottom-inner'>
            {legal.length > 0 && (
              <div className='site-footer-legal'>
                {legal.map((it, i) => (
                  <span className='site-footer-legal-item' key={i}>
                    <FooterLinkItem item={it} />
                  </span>
                ))}
              </div>
            )}
            {data.copyright && (
              <p className='site-footer-copyright'>{data.copyright}</p>
            )}
            {beian && (beian.company || beian.icp || beian.telecomLicense) && (
              <div className='site-footer-beian'>
                {beian.company && (
                  <span className='site-footer-beian-company'>
                    {beian.company}
                  </span>
                )}
                {beian.icp && (
                  <a
                    className='site-footer-beian-link'
                    href={beian.icpHref ?? 'https://beian.miit.gov.cn/'}
                    target='_blank'
                    rel='noreferrer'
                  >
                    {beian.icp}
                  </a>
                )}
                {beian.telecomLicense && (
                  <a
                    className='site-footer-beian-link'
                    href={beian.telecomLicenseHref ?? 'https://dxzhgl.miit.gov.cn/'}
                    target='_blank'
                    rel='noreferrer'
                  >
                    {beian.telecomLicense}
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </footer>
  )
}
