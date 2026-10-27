import '@xyflow/react/dist/style.css'

import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from '@xyflow/react'
import type { Connection, Edge, Viewport } from '@xyflow/react'
import { ArrowLeft, Maximize2, Plus, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import type { NodeMouseHandler } from '@xyflow/react'

import { Button } from '@/components/ui/button'

import './canvas.css'
import { useCanvasDocument, useSaveCanvasDocument } from './hooks'
import { canvasNodeTypes, type CanvasFlowNode } from './nodes'
import {
  parseGraph,
  type CanvasNodeType,
  type SerializedCanvasGraph,
} from './types'

const NODE_DEFAULTS: Record<CanvasNodeType, { title: string; prompt: string }> = {
  image: { title: '', prompt: '' },
  video: { title: '', prompt: '' },
  text: { title: '', prompt: '' },
  note: { title: '', prompt: '' },
}

export function CanvasEditor({ documentId }: { documentId: number }) {
  return (
    <ReactFlowProvider>
      <CanvasEditorInner documentId={documentId} />
    </ReactFlowProvider>
  )
}

function CanvasEditorInner({ documentId }: { documentId: number }) {
  const { t } = useTranslation()
  const { data: doc, isPending, isError } = useCanvasDocument(documentId)
  const saveMutation = useSaveCanvasDocument(documentId)
  const { screenToFlowPosition, getViewport, fitView } = useReactFlow()

  const [nodes, setNodes, onNodesChange] = useNodesState<CanvasFlowNode>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [title, setTitle] = useState('')
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const initialRef = useRef<string>('')
  const loadedRef = useRef(false)

  // 载入服务端图数据
  useEffect(() => {
    if (!doc || loadedRef.current) return
    const graph = parseGraph(doc.graph)
    setNodes(
      graph.nodes.map((n) => ({
        id: n.id,
        type: n.type,
        position: { x: n.x, y: n.y },
        data: n.data ?? {},
      }))
    )
    setEdges(
      graph.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
      }))
    )
    if (graph.viewport) {
      // 视图恢复交由 ReactFlow 默认视口，首次 fitView 处理
    }
    setTitle(doc.title || t('Untitled canvas'))
    initialRef.current = JSON.stringify({
      nodes: graph.nodes,
      edges: graph.edges,
    })
    loadedRef.current = true
  }, [doc, setNodes, setEdges, t])

  const serialize = useCallback(
    (viewport?: Viewport): SerializedCanvasGraph => ({
      nodes: nodes.map((n) => ({
        id: n.id,
        type: (n.type ?? 'note') as CanvasNodeType,
        x: Math.round(n.position.x),
        y: Math.round(n.position.y),
        data: (n.data ?? {}) as SerializedCanvasGraph['nodes'][number]['data'],
      })),
      edges: edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
      })),
      viewport: viewport ?? getViewport(),
    }),
    [nodes, edges, getViewport]
  )

  // 自动保存（防抖 1.2s，首次载入不回写）
  useEffect(() => {
    if (!loadedRef.current) return
    const timer = setTimeout(async () => {
      const current = JSON.stringify({
        nodes: serialize().nodes,
        edges: serialize().edges,
      })
      if (current === initialRef.current) {
        setDirty(false)
        return
      }
      setDirty(true)
      setSaving(true)
      try {
        await saveMutation.mutateAsync({ graph: JSON.stringify(serialize()) })
        initialRef.current = current
        setDirty(false)
      } finally {
        setSaving(false)
      }
    }, 1200)
    return () => clearTimeout(timer)
  }, [nodes, edges, serialize, saveMutation])

  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge(connection, eds)),
    [setEdges]
  )

  const addNode = useCallback(
    (type: CanvasNodeType) => {
      const center = screenToFlowPosition({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      })
      const id = `${type}-${Date.now().toString(36)}`
      setNodes((nds2) => {
        const idx = nds2.length
        return [
          ...nds2,
          {
            id,
            type,
            position: {
              x: Math.round(center.x - 120 + (idx % 3) * 270),
              y: Math.round(center.y - 110 + Math.floor(idx / 3) * 260),
            },
            data: { ...NODE_DEFAULTS[type], status: 'idle' },
          },
        ]
      })
    },
    [screenToFlowPosition, setNodes]
  )

  const deleteSelected = useCallback(() => {
    if (!selectedId) return
    setNodes((nds) => nds.filter((n) => n.id !== selectedId))
    setEdges((eds) =>
      eds.filter((e) => e.source !== selectedId && e.target !== selectedId)
    )
    setSelectedId(null)
  }, [selectedId, setNodes, setEdges])

  const onNodeClick = useCallback<NodeMouseHandler<CanvasFlowNode>>(
    (_event, node) => setSelectedId(node.id),
    []
  )

  const onPaneClick = useCallback(() => setSelectedId(null), [])

  const saveTitle = useCallback(async () => {
    const next = title.trim()
    if (!next || next === doc?.title) return
    try {
      await saveMutation.mutateAsync({ title: next })
      toast.success(t('Saved'))
    } catch {
      toast.error(t('Save failed'))
    }
  }, [title, doc?.title, saveMutation, t])

  const saveStatus = useMemo(() => {
    if (saving) return t('Saving…')
    if (dirty) return t('Unsaved')
    return t('Saved')
  }, [saving, dirty, t])

  useEffect(() => {
    if (!isError) return
    toast.error(t('Canvas not found'))
  }, [isError, t])

  if (isError) {
    return (
      <div className='cv-editor-empty'>
        <p className='text-muted-foreground'>{t('Canvas not found')}</p>
        <Button variant='outline' onClick={() => window.history.back()}>
          {t('Back')}
        </Button>
      </div>
    )
  }

  return (
    <div className='cv-editor'>
      <header className='cv-toolbar'>
        <Button
          variant='ghost'
          size='icon'
          onClick={() => window.history.back()}
          aria-label={t('Back')}
        >
          <ArrowLeft size={16} />
        </Button>
        <input
          className='cv-title-input'
          value={title}
          placeholder={t('Untitled canvas')}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={saveTitle}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
          }}
        />
        <span className='cv-save-state'>{saveStatus}</span>
        <div className='cv-toolbar-actions'>
          <Button variant='outline' size='sm' onClick={() => addNode('image')}>
            <Plus size={14} />
            {t('Image node')}
          </Button>
          <Button variant='outline' size='sm' onClick={() => addNode('video')}>
            <Plus size={14} />
            {t('Video node')}
          </Button>
          <Button variant='outline' size='sm' onClick={() => addNode('text')}>
            <Plus size={14} />
            {t('Text node')}
          </Button>
          <Button variant='outline' size='sm' onClick={() => addNode('note')}>
            <Plus size={14} />
            {t('Note')}
          </Button>
          <Button
            variant='outline'
            size='icon'
            onClick={() => fitView({ padding: 0.2, duration: 300 })}
            aria-label={t('Fit view')}
          >
            <Maximize2 size={14} />
          </Button>
          <Button
            variant='outline'
            size='icon'
            onClick={deleteSelected}
            disabled={!selectedId}
            aria-label={t('Delete selected')}
          >
            <Trash2 size={14} />
          </Button>
        </div>
      </header>

      <div className='cv-canvas-wrap'>
        {isPending ? (
          <div className='cv-editor-empty'>
            <p className='text-muted-foreground'>{t('Loading…')}</p>
          </div>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={canvasNodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            fitView
            minZoom={0.2}
            maxZoom={2.5}
            panOnScroll
            selectionOnDrag
            deleteKeyCode={['Delete', 'Backspace']}
            proOptions={{ hideAttribution: false }}
          >
            <Background variant={BackgroundVariant.Dots} gap={22} size={1} />
            <Controls showInteractive={false} />
            <MiniMap pannable zoomable />
          </ReactFlow>
        )}
        {!isPending && nodes.length === 0 && (
          <div className='cv-hint'>{t('Start by adding a node')}</div>
        )}
      </div>
    </div>
  )
}
