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
import {
  ExternalLink,
  Globe,
  Plus,
  RotateCcw,
  Save,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { api } from '@/lib/api'
import { invalidateSeoConfigCache } from '@/lib/seo'

/** 与后端 service/seo 的 Config 结构一一对应 */
type PageMeta = {
  title?: string
  description?: string
  keywords?: string
  robots?: string
  inSitemap?: boolean
  changeFreq?: string
  priority?: number
}

type SeoConfig = {
  siteName: string
  brand: string
  baseUrl: string
  titleTemplate: string
  defaultTitle: string
  description: string
  keywords: string
  ogImage: string
  twitter?: string
  locale: string
  robots: string
  allowAiCrawlers?: boolean
  verification: { google?: string; baidu?: string; bing?: string }
  pages: Record<string, PageMeta>
  llmsTxt?: string
}

const EMPTY: SeoConfig = {
  siteName: '',
  brand: '',
  baseUrl: '',
  titleTemplate: '{page} · {site}',
  defaultTitle: '',
  description: '',
  keywords: '',
  ogImage: '',
  twitter: '',
  locale: 'zh_CN',
  robots: 'index,follow',
  allowAiCrawlers: true,
  verification: {},
  pages: {},
  llmsTxt: '',
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <div className='space-y-1.5'>
      <div className='flex items-baseline gap-2'>
        <span className='text-sm font-medium'>{label}</span>
        {hint ? (
          <span className='text-muted-foreground text-xs'>{hint}</span>
        ) : null}
      </div>
      {children}
    </div>
  )
}

export function SeoSettingsPage() {
  const { t } = useTranslation()
  const [config, setConfig] = useState<SeoConfig>(EMPTY)
  const [initial, setInitial] = useState<SeoConfig>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const resp = await api.get('/api/seo/config')
      const data = (resp.data?.data ?? EMPTY) as SeoConfig
      const normalized: SeoConfig = {
        ...EMPTY,
        ...data,
        verification: data.verification ?? {},
        pages: data.pages ?? {},
      }
      setConfig(normalized)
      setInitial(normalized)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const set = <K extends keyof SeoConfig>(key: K, value: SeoConfig[K]) =>
    setConfig((c) => ({ ...c, [key]: value }))

  const setPage = (path: string, patch: Partial<PageMeta>) =>
    setConfig((c) => ({
      ...c,
      pages: { ...c.pages, [path]: { ...(c.pages[path] ?? {}), ...patch } },
    }))

  const removePage = (path: string) =>
    setConfig((c) => {
      const next = { ...c.pages }
      delete next[path]
      return { ...c, pages: next }
    })

  const addPage = () => {
    const path = window.prompt('新页面路径，例如 /docs 或 /prompt-gallery', '/')
    if (!path) return
    const p = path.startsWith('/') ? path : `/${path}`
    if (config.pages[p]) {
      toast.error('该路径已存在')
      return
    }
    setPage(p, { title: '', description: '' })
  }

  // 搜索结果预览：用「/」这一页，最贴近用户第一眼看到的样子
  const preview = useMemo(() => {
    const base = (config.baseUrl || 'https://cdymm.com').replace(/\/+$/, '')
    const home = config.pages['/'] ?? {}
    const title = home.title
      ? config.titleTemplate
          .replace('{page}', home.title)
          .replace('{site}', config.siteName)
      : config.defaultTitle || config.siteName
    return {
      title: title || '一串标题',
      url: base + '/',
      desc: home.description || config.description || '这里显示站点描述',
    }
  }, [config])

  async function save() {
    setSaving(true)
    try {
      const payload: SeoConfig = { ...config }
      // 清掉空值，避免把默认配置覆盖成空串
      const resp = await api.put('/api/seo/config', payload)
      if (resp.data?.success === false) {
        throw new Error(resp.data?.message || '保存失败')
      }
      const data = (resp.data?.data ?? payload) as SeoConfig
      setConfig((c) => ({ ...c, ...data }))
      setInitial((c) => ({ ...c, ...data }))
      invalidateSeoConfigCache()
      toast.success(t('Settings saved'))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  const dirty = JSON.stringify(config) !== JSON.stringify(initial)
  const pageEntries = Object.entries(config.pages)

  return (
    <div className='space-y-6 pb-10'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div>
          <h2 className='text-xl font-semibold'>SEO 管理</h2>
          <p className='text-muted-foreground mt-1 text-sm'>
            全站标题、描述、结构化数据与 sitemap 都在这里改，保存即生效（无需重新构建）。
          </p>
        </div>
        <div className='flex items-center gap-2'>
          <Button variant='outline' size='sm' onClick={() => void load()}>
            <RotateCcw className='size-4' />
            重新读取
          </Button>
          <Button size='sm' disabled={saving || !dirty} onClick={() => void save()}>
            <Save className='size-4' />
            {saving ? '保存中…' : dirty ? '保存' : '已保存'}
          </Button>
        </div>
      </div>

      {/* 搜索结果预览：先看效果再改文案，避免「填了不知道长什么样」 */}
      <Card>
        <CardHeader className='pb-3'>
          <CardTitle className='flex items-center gap-2 text-base'>
            <Search className='size-4' />
            搜索结果预览（首页）
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className='bg-background rounded-lg border p-4'>
            <div className='text-muted-foreground text-xs'>{preview.url}</div>
            <div className='mt-0.5 text-[18px] leading-snug text-[#1a0dab] dark:text-[#8ab4f8]'>
              {preview.title}
            </div>
            <div className='text-muted-foreground mt-1 line-clamp-2 text-sm'>
              {preview.desc}
            </div>
          </div>
          <div className='text-muted-foreground mt-2 flex flex-wrap items-center gap-2 text-xs'>
            <Badge variant='secondary'>{config.pages['/']?.title?.length ?? 0} 字标题</Badge>
            <Badge variant='secondary'>
              {(config.pages['/']?.description || config.description).length} 字描述
            </Badge>
            <span>建议：标题 30–60 字，描述 70–160 字。</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className='pb-3'>
          <CardTitle className='flex items-center gap-2 text-base'>
            <Globe className='size-4' />
            全站默认
          </CardTitle>
        </CardHeader>
        <CardContent className='grid gap-4 md:grid-cols-2'>
          <Field label='站点名称' hint='出现在标题模板与 OG 站点名'>
            <Input
              value={config.siteName}
              onChange={(e) => set('siteName', e.target.value)}
              placeholder='一幕AI'
            />
          </Field>
          <Field label='品牌简称' hint='结构化数据里的 alternateName'>
            <Input
              value={config.brand}
              onChange={(e) => set('brand', e.target.value)}
              placeholder='YMM'
            />
          </Field>
          <Field label='站点地址' hint='canonical / sitemap 的域名前缀，不要带尾斜杠'>
            <Input
              value={config.baseUrl}
              onChange={(e) => set('baseUrl', e.target.value)}
              placeholder='https://cdymm.com'
            />
          </Field>
          <Field label='标题模板' hint='{page} 页面标题，{site} 站点名'>
            <Input
              value={config.titleTemplate}
              onChange={(e) => set('titleTemplate', e.target.value)}
              placeholder='{page} · {site}'
            />
          </Field>
          <Field label='默认标题' hint='没配页面标题时用它'>
            <Input
              value={config.defaultTitle}
              onChange={(e) => set('defaultTitle', e.target.value)}
            />
          </Field>
          <Field label='分享图（OG Image）' hint='建议 1200×630，填完整 URL'>
            <Input
              value={config.ogImage}
              onChange={(e) => set('ogImage', e.target.value)}
              placeholder='https://cdymm.com/logo.png'
            />
          </Field>
          <Field label='默认描述'>
            <Textarea
              rows={3}
              value={config.description}
              onChange={(e) => set('description', e.target.value)}
            />
          </Field>
          <Field label='默认关键词' hint='英文逗号分隔，权重已很低，别堆砌'>
            <Textarea
              rows={3}
              value={config.keywords}
              onChange={(e) => set('keywords', e.target.value)}
            />
          </Field>
          <Field label='语言标记' hint='og:locale，如 zh_CN'>
            <Input
              value={config.locale}
              onChange={(e) => set('locale', e.target.value)}
            />
          </Field>
          <Field label='默认 robots' hint='首页建议 index,follow'>
            <Input
              value={config.robots}
              onChange={(e) => set('robots', e.target.value)}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className='pb-3'>
          <div className='flex items-center justify-between'>
            <CardTitle className='text-base'>页面级覆盖</CardTitle>
            <Button variant='outline' size='sm' onClick={addPage}>
              <Plus className='size-4' />
              添加页面
            </Button>
          </div>
        </CardHeader>
        <CardContent className='space-y-3'>
          {pageEntries.length === 0 ? (
            <p className='text-muted-foreground text-sm'>
              还没有页面配置。点「添加页面」开始，未配置的页面会走全站默认值。
            </p>
          ) : null}
          {pageEntries.map(([path, meta]) => (
            <div key={path} className='space-y-2 rounded-lg border p-3'>
              <div className='flex flex-wrap items-center gap-2'>
                <Badge variant='outline' className='font-mono'>
                  {path}
                </Badge>
                <Input
                  className='h-8 max-w-[220px]'
                  value={meta.robots ?? ''}
                  onChange={(e) => setPage(path, { robots: e.target.value })}
                  placeholder='robots（留空=默认）'
                />
                <Button
                  variant='ghost'
                  size='icon'
                  className='ml-auto size-8'
                  onClick={() => removePage(path)}
                  aria-label='删除该页配置'
                >
                  <Trash2 className='size-4' />
                </Button>
              </div>
              <Input
                value={meta.title ?? ''}
                onChange={(e) => setPage(path, { title: e.target.value })}
                placeholder='页面标题（不要带站名，模板会自动拼）'
              />
              <Textarea
                rows={2}
                value={meta.description ?? ''}
                onChange={(e) => setPage(path, { description: e.target.value })}
                placeholder='页面描述（70–160 字，写清这页能给用户什么）'
              />
              <Input
                value={meta.keywords ?? ''}
                onChange={(e) => setPage(path, { keywords: e.target.value })}
                placeholder='页面关键词（可选）'
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className='pb-3'>
          <CardTitle className='flex items-center gap-2 text-base'>
            <Sparkles className='size-4' />
            大模型收录（GEO）
          </CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='flex items-start justify-between gap-4 rounded-lg border p-3'>
            <div>
              <div className='text-sm font-medium'>放行大模型爬虫</div>
              <p className='text-muted-foreground mt-1 text-xs leading-relaxed'>
                打开后 robots.txt 会显式允许 GPTBot / OAI-SearchBot / ClaudeBot /
                PerplexityBot / Google-Extended 等抓取。关掉等于从 AI 搜索里消失。
              </p>
            </div>
            <Switch
              checked={config.allowAiCrawlers !== false}
              onCheckedChange={(v) => set('allowAiCrawlers', v === true)}
            />
          </div>

          <Field
            label='llms.txt'
            hint='留空自动生成；这是给大模型看的站点说明书'
          >
            <Textarea
              rows={8}
              className='font-mono text-xs'
              value={config.llmsTxt ?? ''}
              onChange={(e) => set('llmsTxt', e.target.value)}
              placeholder='留空 = 按站点信息自动生成。想自定义就按 llms.txt 规范写：一行 # 站名，> 一句话简介，然后分节列页面。'
            />
          </Field>

          <div className='flex flex-wrap gap-2'>
            <Button
              variant='outline'
              size='sm'
              onClick={() => window.open('/robots.txt', '_blank')}
            >
              <ExternalLink className='size-4' />
              预览 robots.txt
            </Button>
            <Button
              variant='outline'
              size='sm'
              onClick={() => window.open('/sitemap.xml', '_blank')}
            >
              <ExternalLink className='size-4' />
              预览 sitemap.xml
            </Button>
            <Button
              variant='outline'
              size='sm'
              onClick={() => window.open('/llms.txt', '_blank')}
            >
              <ExternalLink className='size-4' />
              预览 llms.txt
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className='pb-3'>
          <CardTitle className='text-base'>站长平台验证</CardTitle>
        </CardHeader>
        <CardContent className='grid gap-4 md:grid-cols-3'>
          <Field label='Google' hint='google-site-verification'>
            <Input
              value={config.verification.google ?? ''}
              onChange={(e) =>
                set('verification', {
                  ...config.verification,
                  google: e.target.value,
                })
              }
            />
          </Field>
          <Field label='百度' hint='baidu-site-verification'>
            <Input
              value={config.verification.baidu ?? ''}
              onChange={(e) =>
                set('verification', {
                  ...config.verification,
                  baidu: e.target.value,
                })
              }
            />
          </Field>
          <Field label='Bing' hint='msvalidate.01'>
            <Input
              value={config.verification.bing ?? ''}
              onChange={(e) =>
                set('verification', {
                  ...config.verification,
                  bing: e.target.value,
                })
              }
            />
          </Field>
        </CardContent>
      </Card>

      {loading ? (
        <p className='text-muted-foreground text-sm'>读取配置中…</p>
      ) : null}
    </div>
  )
}
