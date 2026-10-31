/**
 * ymm-bridge 落地页的对外事实常量（二开）
 * ------------------------------------------------------------------
 * 这里只放「会变的事实」：下载地址、版本号、端口、目录名。
 * 改包不改变页面结构，只想换一版节点时只动本文件即可。
 *
 * 铁律：本文件里的每个值都必须与 comfyui-ymm-bridge 的真实实现一致，
 * 落地页承诺「点了就能装上」，写错版本/路径等于给客户一个坏链接。
 */

/** 落地页路由（导航预设与 SEO 配置都用这个常量，避免两处漂移） */
export const BRIDGE_PAGE_PATH = '/comfyui'

/** 节点版本号：与 public/downloads/ymm-bridge.zip 内的文件同步 */
export const BRIDGE_VERSION = '1.0.0'

/** 站内静态下载地址（rsbuild 把 web/public 原样拷到 dist 根） */
export const BRIDGE_ZIP_URL = '/downloads/ymm-bridge.zip'

/** 压缩包体积，仅用于页面展示；重新打包后同步这里 */
export const BRIDGE_ZIP_SIZE = '6.5 KB'

/** ComfyUI 默认端口：节点只在这个端口下能被「去创作」唤起 */
export const COMFY_PORT = 8188

/** 节点在 custom_nodes 下的目录名 */
export const BRIDGE_DIR_NAME = 'comfyui-ymm-bridge'

/** 解压后要放到的目标路径（多套一层目录会导致加载不到） */
export const CUSTOM_NODES_PATH = `ComfyUI/custom_nodes/${BRIDGE_DIR_NAME}/`

/** 画廊列表页：装完引导客户去挑作品 */
export const GALLERY_PATH = '/prompt-gallery'

/** 站内「去创作」在详情页里的按钮名，FAQ 里要准确引用 */
export const CREATE_BUTTON_LABEL = 'ComfyUI 一键生图'
