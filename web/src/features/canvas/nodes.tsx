import { Handle, Position, useReactFlow } from '@xyflow/react'
import { ImageIcon, Play, StickyNote, Type } from 'lucide-react'
import type { NodeProps, Node } from '@xyflow/react'
import { useCallback } from 'react'

import type { CanvasNodeData, CanvasNodeType } from './types'

export type CanvasFlowNode = Node<CanvasNodeData, CanvasNodeType>

const STATUS_TEXT: Record<string, string> = {
  idle: '待生成',
  running: '生成中',
  success: '已完成',
  error: '失败',
}

function usePatchData(id: string) {
  const { setNodes } = useReactFlow()
  return useCallback(
    (patch: Partial<CanvasNodeData>) => {
      setNodes((nodes) =>
        nodes.map((node) =>
          node.id === id
            ? { ...node, data: { ...node.data, ...patch } }
            : node
        )
      )
    },
    [id, setNodes]
  )
}

function NodeShell({
  children,
  kind,
  selected,
  status,
}: {
  children: React.ReactNode
  kind: CanvasNodeType
  selected?: boolean
  status?: string
}) {
  const icon =
    kind === 'image' ? (
      <ImageIcon size={13} />
    ) : kind === 'video' ? (
      <Play size={13} />
    ) : kind === 'text' ? (
      <Type size={13} />
    ) : (
      <StickyNote size={13} />
    )
  const label =
    kind === 'image' ? '图片' : kind === 'video' ? '视频' : kind === 'text' ? '文本' : '便签'
  return (
    <div className={`cv-node cv-node-${kind}${selected ? ' is-selected' : ''}`}>
      <div className='cv-node-head'>
        <span className='cv-node-kind'>
          {icon}
          {label}
        </span>
        {status ? (
          <span className={`cv-node-status cv-status-${status}`}>
            {STATUS_TEXT[status] ?? status}
          </span>
        ) : null}
      </div>
      {children}
      <Handle type='target' position={Position.Left} className='cv-handle' />
      <Handle type='source' position={Position.Right} className='cv-handle' />
    </div>
  )
}

export function ImageNode({ id, data, selected }: NodeProps<CanvasFlowNode>) {
  const patch = usePatchData(id)
  const status = data.status ?? 'idle'
  return (
    <NodeShell kind='image' selected={selected} status={status}>
      <div className='cv-node-media'>
        {data.media?.url ? (
          <img src={data.media.url} alt={data.title ?? ''} loading='lazy' />
        ) : (
          <div className='cv-node-placeholder'>
            <ImageIcon size={22} />
          </div>
        )}
      </div>
      <input
        className='cv-node-title'
        value={data.title ?? ''}
        placeholder='标题'
        onChange={(e) => patch({ title: e.target.value })}
      />
      <textarea
        className='cv-node-prompt'
        value={data.prompt ?? ''}
        placeholder='描述你想生成的画面…'
        rows={2}
        onChange={(e) => patch({ prompt: e.target.value })}
      />
    </NodeShell>
  )
}

export function VideoNode({ id, data, selected }: NodeProps<CanvasFlowNode>) {
  const patch = usePatchData(id)
  const status = data.status ?? 'idle'
  return (
    <NodeShell kind='video' selected={selected} status={status}>
      <div className='cv-node-media'>
        {data.media?.url ? (
          <video src={data.media.url} muted loop playsInline />
        ) : (
          <div className='cv-node-placeholder'>
            <Play size={22} />
          </div>
        )}
      </div>
      <input
        className='cv-node-title'
        value={data.title ?? ''}
        placeholder='标题'
        onChange={(e) => patch({ title: e.target.value })}
      />
      <textarea
        className='cv-node-prompt'
        value={data.prompt ?? ''}
        placeholder='描述镜头与运动…'
        rows={2}
        onChange={(e) => patch({ prompt: e.target.value })}
      />
    </NodeShell>
  )
}

export function TextNode({ id, data, selected }: NodeProps<CanvasFlowNode>) {
  const patch = usePatchData(id)
  return (
    <NodeShell kind='text' selected={selected}>
      <textarea
        className='cv-node-body'
        value={data.prompt ?? ''}
        placeholder='输入文本…'
        rows={4}
        onChange={(e) => patch({ prompt: e.target.value })}
      />
    </NodeShell>
  )
}

export function NoteNode({ id, data, selected }: NodeProps<CanvasFlowNode>) {
  const patch = usePatchData(id)
  return (
    <NodeShell kind='note' selected={selected}>
      <textarea
        className='cv-node-body cv-node-body-note'
        value={data.prompt ?? ''}
        placeholder='随手记一笔…'
        rows={4}
        onChange={(e) => patch({ prompt: e.target.value })}
      />
    </NodeShell>
  )
}

export const canvasNodeTypes = {
  image: ImageNode,
  video: VideoNode,
  text: TextNode,
  note: NoteNode,
}
