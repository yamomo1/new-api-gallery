/*
 * 二开：画布工作台（infinite-canvas 开源前端）地址
 * ------------------------------------------------------------------
 * 画布编辑器是独立部署的 Vite 应用（与 New API 前端技术栈不同），
 * 站内所有画布入口（/canvas、/canvas/:id、我的画布）都跳转到它。
 *
 * 部署到别的域名时只改这一处；留空字符串则站内画布入口显示「未配置」。
 * 也可用构建期环境变量 VITE_CANVAS_STUDIO_URL 覆盖。
 */
const ENV_STUDIO_URL = (
  import.meta as unknown as { env?: Record<string, string | undefined> }
).env?.VITE_CANVAS_STUDIO_URL

/** 本地开发默认指向画布 dev/preview 服务，线上默认指向画布子域 */
function defaultStudioUrl(): string {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname
    if (host === '127.0.0.1' || host === 'localhost') {
      return 'http://127.0.0.1:5189'
    }
  }
  return 'https://canvas.cdymm.com'
}

export const CANVAS_STUDIO_URL = (
  ENV_STUDIO_URL || defaultStudioUrl()
).replace(/\/+$/, '')

/** 画布工作台入口（画布列表 / 新建画布） */
export function canvasStudioHomeUrl(): string | null {
  if (!CANVAS_STUDIO_URL) return null
  return `${CANVAS_STUDIO_URL}/canvas`
}

export function canvasStudioNewUrl(): string | null {
  if (!CANVAS_STUDIO_URL) return null
  return `${CANVAS_STUDIO_URL}/canvas?mode=new`
}

/** 打开指定画布文档的编辑器地址；未配置工作台地址时返回 null */
export function canvasStudioUrl(remoteId: number): string | null {
  if (!CANVAS_STUDIO_URL) return null
  return `${CANVAS_STUDIO_URL}/canvas?open=${remoteId}`
}
