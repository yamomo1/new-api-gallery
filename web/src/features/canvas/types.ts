// 画布图数据模型（二开新增）
// 结构参考 open-canvas（MIT）的 SerializedCanvasGraph：{ nodes, edges, viewport }
// 节点状态沿用 idle / running / success / error，便于后续接真实生图/生视频任务。

export type CanvasNodeStatus = 'idle' | 'running' | 'success' | 'error'

/** 节点类型：对标站为 image/video/text/audio/group/output/prompt，第一版先落 4 类 */
export type CanvasNodeType = 'image' | 'video' | 'text' | 'note'

export type CanvasNodeMedia = {
  url: string
  /** generated = 平台生成；uploaded = 用户上传；reference = 参考图 */
  source?: 'generated' | 'uploaded' | 'reference'
}

export type CanvasNodeData = {
  title?: string
  /** 文本节点正文 / 图片视频节点的提示词 */
  prompt?: string
  status?: CanvasNodeStatus
  media?: CanvasNodeMedia | null
  /** 生成参数（模型、尺寸等，第一版仅占位） */
  params?: Record<string, unknown> | null
  error?: string | null
}

export type SerializedCanvasNode = {
  id: string
  type: CanvasNodeType
  x: number
  y: number
  width?: number
  height?: number
  data: CanvasNodeData
}

export type SerializedCanvasEdge = {
  id: string
  source: string
  target: string
}

export type CanvasViewport = {
  x: number
  y: number
  zoom: number
}

export type SerializedCanvasGraph = {
  nodes: SerializedCanvasNode[]
  edges: SerializedCanvasEdge[]
  viewport?: CanvasViewport
}

export const EMPTY_GRAPH: SerializedCanvasGraph = {
  nodes: [],
  edges: [],
  viewport: { x: 0, y: 0, zoom: 1 },
}

/** 后端画布文档 */
export type CanvasDocument = {
  id: number
  user_id: number
  title: string
  graph: string
  created_at: number
  updated_at: number
}

/** 列表项（后端列表接口不含 graph 体） */
export type CanvasDocumentSummary = {
  id: number
  user_id: number
  title: string
  created_at: number
  updated_at: number
}

export function parseGraph(raw: string | null | undefined): SerializedCanvasGraph {
  if (!raw) return { ...EMPTY_GRAPH }
  try {
    const parsed = JSON.parse(raw) as Partial<SerializedCanvasGraph>
    return {
      nodes: Array.isArray(parsed.nodes) ? parsed.nodes : [],
      edges: Array.isArray(parsed.edges) ? parsed.edges : [],
      viewport: parsed.viewport ?? { x: 0, y: 0, zoom: 1 },
    }
  } catch {
    return { ...EMPTY_GRAPH }
  }
}
