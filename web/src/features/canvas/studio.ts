/*
 * 二开：画布工作台（infinite-canvas 独立前端）地址
 * ------------------------------------------------------------------
 * 画布编辑器是独立部署的 Vite 应用（与 New API 前端技术栈不同），
 * 画廊里的「打开画布」会跳转到它，并带上 ?open=<文档 id>。
 *
 * 部署到别的域名时只改这一处；留空字符串则隐藏所有跳转入口。
 * 也可用构建期环境变量 VITE_CANVAS_STUDIO_URL 覆盖。
 */
const ENV_STUDIO_URL = (
  import.meta as unknown as { env?: Record<string, string | undefined> }
).env?.VITE_CANVAS_STUDIO_URL

export const CANVAS_STUDIO_URL = (
  ENV_STUDIO_URL || 'https://canvas.cdymm.com'
).replace(/\/+$/, '')

/** 打开指定画布文档的编辑器地址；未配置工作台地址时返回 null */
export function canvasStudioUrl(remoteId: number): string | null {
  if (!CANVAS_STUDIO_URL) return null
  return `${CANVAS_STUDIO_URL}/canvas?open=${remoteId}`
}
