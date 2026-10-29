/*
 * 二开：画布工作台（infinite-canvas 开源前端）地址
 * ------------------------------------------------------------------
 * 画布编辑器已编进 New API 二进制，由后端统一托管在 /studio/（与主站同域），
 * 站内所有画布入口（/canvas、/canvas/:id、工作台 /workspace）都跳转到它。
 *
 * 不再依赖外部域名：线上默认即「当前访问域名 + /studio」，无需任何额外配置即可用。
 * - 生产/线上：使用与当前访问同域的 /studio（${origin}/studio）
 * - 本地开发：默认指向画布 dev/preview 服务 http://127.0.0.1:5189
 * - 仍可用构建期环境变量 VITE_CANVAS_STUDIO_URL 覆盖（例如本地联调指向 dev 服务）
 *
 * 历史：画布曾独立部署在 canvas.cdymm.com，现已并入 New API，本文件不再保留该域名。
 */
const ENV_STUDIO_URL = (
  import.meta as unknown as { env?: Record<string, string | undefined> }
).env?.VITE_CANVAS_STUDIO_URL

/** 解析画布工作台地址；始终同域（/studio），不再硬编码外部域名 */
function defaultStudioUrl(): string {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname
    // 本地开发：连画布 dev/preview（vite 默认 5189）
    if (host === '127.0.0.1' || host === 'localhost') {
      return 'http://127.0.0.1:5189'
    }
    // 线上/生产：与主站同域，画布由后端托管在 /studio/
    return `${window.location.origin}/studio`
  }
  // 非浏览器上下文（SSR/build）：同域相对路径兜底
  return '/studio'
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
