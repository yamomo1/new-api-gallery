import { createFileRoute } from '@tanstack/react-router'

import { ComfyUIBridgeLanding } from '@/features/comfyui-bridge'

/**
 * ymm-bridge 落地页：/comfyui
 *
 * 公开路由（不需要登录）—— ComfyUI 用户多半还不是站内用户，
 * 页面要能被直接分享、被搜索引擎收录，装完再引导去画廊。
 * 新增本路由后必须同步 router/web-router.go 的 knownSpaSegments，
 * 否则 Go 侧 NoRoute 会当作未知路径返回 404。
 */
export const Route = createFileRoute('/comfyui/')({
  component: ComfyUIBridgeLanding,
})
