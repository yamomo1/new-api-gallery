/**
 * 工作台 · 个人作品区（项目/文件夹 + 我的作品卡片流）
 */
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Check,
  Clapperboard,
  Grid2x2,
  HelpCircle,
  Image as ImageIcon,
  List,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
  FolderInput,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import {
  useCreateGalleryProject,
  useCreateMyWork,
  useDeleteGalleryProject,
  useDeleteMyWork,
  useGalleryProjects,
  useMyWorks,
  useRenameGalleryProject,
  useSetMyWorkProject,
  useUpdateMyWork,
} from './hooks'
import type {
  GalleryProject,
  WorkspaceFilter,
  WorkspaceSort,
  WorkspaceWork,
} from './types'

const GRADIENTS = [
  'linear-gradient(135deg,#c084fc 0%,#f59e0b 100%)',
  'linear-gradient(135deg,#34d399 0%,#0ea5e9 100%)',
  'linear-gradient(135deg,#f472b6 0%,#818cf8 100%)',
  'linear-gradient(135deg,#fbbf24 0%,#ef4444 100%)',
  'linear-gradient(135deg,#60a5fa 0%,#a78bfa 100%)',
]

function gradientFor(seed: number) {
  return GRADIENTS[Math.abs(seed) % GRADIENTS.length]
}

function parseMedia(media: string): string[] {
  try {
    const arr = JSON.parse(media)
    return Array.isArray(arr) ? arr.filter((u) => typeof u === 'string') : []
  } catch {
    return media ? [media] : []
  }
}

function timeAgo(ts: number, zh: boolean) {
  const s = Math.max(1, Math.floor(Date.now() / 1000 - ts))
  if (s < 60) return zh ? `${s} 秒前` : `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return zh ? `${m} 分钟前` : `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return zh ? `${h} 小时前` : `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30) return zh ? `${d} 天前` : `${d}d ago`
  const date = new Date(ts * 1000)
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`
}

type ProjectForm = { id: number | null; name: string; kind: 'project' | 'folder' }
type WorkForm = {
  id: number | null
  title: string
  type: 'image' | 'video'
  cover: string
  mediaUrl: string
  prompt: string
  projectId: string
}

const EMPTY_WORK: WorkForm = {
  id: null,
  title: '',
  type: 'image',
  cover: '',
  mediaUrl: '',
  prompt: '',
  projectId: '0',
}

export function WorksSection() {
  const { t, i18n } = useTranslation()
  const zh = i18n.language?.startsWith('zh')

  const [filter, setFilter] = useState<WorkspaceFilter>('all')
  const [sort, setSort] = useState<WorkspaceSort>('latest')
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [search, setSearch] = useState('')

  const [projectDialog, setProjectDialog] = useState<ProjectForm | null>(null)
  const [workDialog, setWorkDialog] = useState<WorkForm | null>(null)
  const [preview, setPreview] = useState<WorkspaceWork | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<
    { kind: 'project' | 'work'; id: number; name: string } | null
  >(null)

  const { data: projects = [] } = useGalleryProjects()
  const worksQuery = useMyWorks({
    project_id: -1,
    search: search.trim() || undefined,
    sort,
    limit: 60,
  })
  const works = useMemo(
    () => (worksQuery.data?.items ?? []) as WorkspaceWork[],
    [worksQuery.data]
  )

  const createProject = useCreateGalleryProject()
  const renameProject = useRenameGalleryProject()
  const deleteProject = useDeleteGalleryProject()
  const createWork = useCreateMyWork()
  const updateWork = useUpdateMyWork()
  const deleteWork = useDeleteMyWork()
  const moveWork = useSetMyWorkProject()

  const shownProjects = useMemo(() => {
    let list: GalleryProject[] = projects
    if (filter === 'folder') list = list.filter((p) => p.kind === 'folder')
    if (filter === 'project') list = list.filter((p) => p.kind === 'project')
    if (filter === 'image' || filter === 'video') return []
    if (search.trim()) {
      const kw = search.trim().toLowerCase()
      list = list.filter((p) => p.name.toLowerCase().includes(kw))
    }
    return sort === 'latest' ? list : [...list].reverse()
  }, [projects, filter, search, sort])

  const shownWorks = useMemo(() => {
    let list: WorkspaceWork[] = works
    if (filter === 'image') list = list.filter((w) => w.type === 'image')
    if (filter === 'video') list = list.filter((w) => w.type === 'video')
    if (filter === 'folder' || filter === 'project') return []
    return list
  }, [works, filter])

  const workCountOf = (projectId: number) =>
    works.filter((w) => w.project_id === projectId).length

  const submitProject = () => {
    if (!projectDialog) return
    const name = projectDialog.name.trim()
    if (!name) {
      toast.error(t('Please enter a name'))
      return
    }
    if (projectDialog.id == null) {
      createProject.mutate(
        { name, kind: projectDialog.kind },
        { onSuccess: () => setProjectDialog(null) }
      )
    } else {
      renameProject.mutate(
        { id: projectDialog.id, name },
        { onSuccess: () => setProjectDialog(null) }
      )
    }
  }

  const submitWork = () => {
    if (!workDialog) return
    const title = workDialog.title.trim()
    if (!title) {
      toast.error(t('Please enter a title'))
      return
    }
    const wid = workDialog.id
    const projectId = Number(workDialog.projectId) || 0
    const media = workDialog.mediaUrl.trim()
    const payload = {
      title,
      prompt: workDialog.prompt.trim(),
      model: '',
      type: workDialog.type,
      cover: workDialog.cover.trim(),
      media: media ? JSON.stringify([media]) : '[]',
      category: '',
      tags: '',
      project_id: projectId,
    }
    if (wid == null) {
      createWork.mutate(payload, {
        onSuccess: (item) => {
          const created = item as unknown as { id?: number }
          if (projectId && created?.id) {
            moveWork.mutate({ id: created.id, projectId })
          }
          setWorkDialog(null)
        },
      })
    } else {
      updateWork.mutate(
        { id: wid, payload },
        {
          onSuccess: () => {
            moveWork.mutate({ id: wid, projectId })
            setWorkDialog(null)
          },
        }
      )
    }
  }

  const doConfirmDelete = () => {
    if (!confirmDelete) return
    if (confirmDelete.kind === 'project') {
      deleteProject.mutate(confirmDelete.id, {
        onSuccess: () => setConfirmDelete(null),
      })
    } else {
      deleteWork.mutate(confirmDelete.id, {
        onSuccess: () => setConfirmDelete(null),
      })
    }
  }

  const FILTER_LABEL: Record<WorkspaceFilter, string> = {
    all: t('workspace.filter.all'),
    folder: t('workspace.filter.folder'),
    project: t('workspace.filter.project'),
    image: t('workspace.filter.image'),
    video: t('workspace.filter.video'),
  }

  const filterLabel =
    filter === 'all'
      ? t('workspace.filter.showAll')
      : FILTER_LABEL[filter]

  return (
    <section className='wk-works'>
      <div className='wk-works-bar'>
        <h2 className='wk-works-title'>
          {t('workspace.works.mine')}
          <span className='wk-works-help' title={t('workspace.works.help')}>
            <HelpCircle size={13} />
          </span>
        </h2>

        <div className='wk-works-tools'>
          <div className='wk-search'>
            <Search size={14} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('Search')}
            />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button type='button' className='wk-pill-btn'>
                  {filterLabel}
                  <span className='wk-caret'>▾</span>
                </button>
              }
            />
            <DropdownMenuContent align='end' className='wk-filter-menu'>
              <DropdownMenuGroup>
                <DropdownMenuLabel>{t('workspace.filter.group')}</DropdownMenuLabel>
                {(['all', 'folder', 'project', 'image', 'video'] as const).map(
                  (key) => (
                    <DropdownMenuItem
                      key={key}
                      onClick={() => setFilter(key)}
                      className='wk-filter-item'
                    >
                      <span>{FILTER_LABEL[key]}</span>
                      {filter === key && <Check size={14} />}
                    </DropdownMenuItem>
                  )
                )}
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuLabel>{t('workspace.sort.group')}</DropdownMenuLabel>
                <DropdownMenuItem
                  onClick={() => setSort('latest')}
                  className='wk-filter-item'
                >
                  <span>{t('workspace.sort.latest')}</span>
                  {sort === 'latest' && <Check size={14} />}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setSort('oldest')}
                  className='wk-filter-item'
                >
                  <span>{t('workspace.sort.oldest')}</span>
                  {sort === 'oldest' && <Check size={14} />}
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className='wk-view-group'>
            <button
              type='button'
              className={view === 'grid' ? 'wk-view-btn wk-view-active' : 'wk-view-btn'}
              aria-label={t('workspace.view.grid')}
              onClick={() => setView('grid')}
            >
              <Grid2x2 size={15} />
            </button>
            <button
              type='button'
              className={view === 'list' ? 'wk-view-btn wk-view-active' : 'wk-view-btn'}
              aria-label={t('workspace.view.list')}
              onClick={() => setView('list')}
            >
              <List size={15} />
            </button>
            <button
              type='button'
              className={
                filter === 'image' ? 'wk-view-btn wk-view-active' : 'wk-view-btn'
              }
              aria-label={t('workspace.filter.image')}
              onClick={() => setFilter(filter === 'image' ? 'all' : 'image')}
            >
              <ImageIcon size={15} />
            </button>
            <button
              type='button'
              className={
                filter === 'video' ? 'wk-view-btn wk-view-active' : 'wk-view-btn'
              }
              aria-label={t('workspace.filter.video')}
              onClick={() => setFilter(filter === 'video' ? 'all' : 'video')}
            >
              <Clapperboard size={15} />
            </button>
          </div>

          <button
            type='button'
            className='wk-add-work-btn'
            onClick={() => setWorkDialog({ ...EMPTY_WORK })}
          >
            <Plus size={14} />
            {t('workspace.works.addWork')}
          </button>

          <button
            type='button'
            className='wk-new-project-btn'
            onClick={() => setProjectDialog({ id: null, name: '', kind: 'project' })}
          >
            <Plus size={14} />
            {t('workspace.works.newProject')}
          </button>
        </div>
      </div>

      <div className={view === 'grid' ? 'wk-cards' : 'wk-cards wk-cards-list'}>
        <button
          type='button'
          className='wk-card wk-card-new'
          onClick={() => setProjectDialog({ id: null, name: '', kind: 'project' })}
        >
          <span className='wk-card-new-circle'>
            <Plus size={22} />
          </span>
          <span className='wk-card-new-label'>{t('workspace.works.newProject')}</span>
        </button>

        {shownProjects.map((p) => (
          <div
            key={`p-${p.id}`}
            className='wk-card'
            onClick={() => setProjectDialog({ id: p.id, name: p.name, kind: p.kind })}
          >
            <div
              className='wk-card-cover'
              style={
                p.cover
                  ? { backgroundImage: `url(${p.cover})`, backgroundSize: 'cover' }
                  : { background: gradientFor(p.id) }
              }
            >
              <span className='wk-card-kind'>
                {p.kind === 'folder'
                  ? t('workspace.filter.folder')
                  : t('workspace.filter.project')}
              </span>
            </div>
            <div className='wk-card-meta'>
              <div className='wk-card-title'>{p.name}</div>
              <div className='wk-card-time'>
                {t('workspace.editedAt')} {timeAgo(p.updated_at, zh)}
                {' · '}
                {t('workspace.workCount', { count: workCountOf(p.id) })}
              </div>
            </div>
            <CardMenu
              onEdit={() => setProjectDialog({ id: p.id, name: p.name, kind: p.kind })}
              onDelete={() =>
                setConfirmDelete({ kind: 'project', id: p.id, name: p.name })
              }
            />
          </div>
        ))}

        {shownWorks.map((w) => {
          const firstMedia = parseMedia(w.media)[0] || w.cover
          return (
            <div
              key={`w-${w.id}`}
              className='wk-card'
              onClick={() => setPreview(w)}
            >
              <div
                className='wk-card-cover'
                style={
                  w.cover
                    ? { backgroundImage: `url(${w.cover})`, backgroundSize: 'cover' }
                    : { background: gradientFor(w.id) }
                }
              >
                {w.type === 'video' && (
                  <span className='wk-card-kind'>
                    <Clapperboard size={11} />
                    {t('workspace.filter.video')}
                  </span>
                )}
              </div>
              <div className='wk-card-meta'>
                <div className='wk-card-title'>{w.title}</div>
                <div className='wk-card-time'>
                  {t('workspace.editedAt')} {timeAgo(w.updated_at, zh)}
                  {w.status !== 'published' && (
                    <span className='wk-card-status'>
                      {w.status === 'draft'
                        ? t('workspace.status.draft')
                        : t('workspace.status.rejected')}
                    </span>
                  )}
                </div>
              </div>
              <CardMenu
                onEdit={() =>
                  setWorkDialog({
                    id: w.id,
                    title: w.title,
                    type: w.type,
                    cover: w.cover,
                    mediaUrl: firstMedia || '',
                    prompt: w.prompt,
                    projectId: String(w.project_id || 0),
                  })
                }
                onDelete={() =>
                  setConfirmDelete({ kind: 'work', id: w.id, name: w.title })
                }
                onMove={(projectId) => moveWork.mutate({ id: w.id, projectId })}
                projects={projects}
              />
            </div>
          )
        })}
      </div>

      {shownProjects.length === 0 && shownWorks.length === 0 && search.trim() && (
        <div className='wk-empty'>{t('workspace.empty.search')}</div>
      )}

      {/* 新建 / 重命名项目 */}
      <Dialog
        open={projectDialog != null}
        onOpenChange={(open) => !open && setProjectDialog(null)}
      >
        <DialogContent className='wk-dialog'>
          <DialogHeader>
            <DialogTitle>
              {projectDialog?.id == null
                ? t('workspace.works.newProject')
                : t('workspace.project.rename')}
            </DialogTitle>
          </DialogHeader>
          <div className='wk-field'>
            <Label>{t('workspace.project.name')}</Label>
            <Input
              autoFocus
              value={projectDialog?.name ?? ''}
              onChange={(e) =>
                setProjectDialog((prev) =>
                  prev ? { ...prev, name: e.target.value } : prev
                )
              }
              onKeyDown={(e) => e.key === 'Enter' && submitProject()}
              placeholder={t('workspace.project.namePlaceholder')}
            />
          </div>
          {projectDialog?.id == null && (
            <div className='wk-field'>
              <Label>{t('workspace.project.kind')}</Label>
              <Select
                value={projectDialog?.kind ?? 'project'}
                onValueChange={(v) =>
                  setProjectDialog((prev) =>
                    prev ? { ...prev, kind: v === 'folder' ? 'folder' : 'project' } : prev
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='project'>
                    {t('workspace.filter.project')}
                  </SelectItem>
                  <SelectItem value='folder'>
                    {t('workspace.filter.folder')}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <DialogFooter>
            <Button variant='outline' onClick={() => setProjectDialog(null)}>
              {t('Cancel')}
            </Button>
            <Button onClick={submitProject}>{t('Save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 新建 / 编辑作品 */}
      <Dialog
        open={workDialog != null}
        onOpenChange={(open) => !open && setWorkDialog(null)}
      >
        <DialogContent className='wk-dialog wk-dialog-work'>
          <DialogHeader>
            <DialogTitle>
              {workDialog?.id == null
                ? t('workspace.works.addWork')
                : t('workspace.work.edit')}
            </DialogTitle>
          </DialogHeader>
          <div className='wk-field'>
            <Label>{t('workspace.work.title')}</Label>
            <Input
              autoFocus
              value={workDialog?.title ?? ''}
              onChange={(e) =>
                setWorkDialog((prev) =>
                  prev ? { ...prev, title: e.target.value } : prev
                )
              }
              placeholder={t('workspace.work.titlePlaceholder')}
            />
          </div>
          <div className='wk-field-row'>
            <div className='wk-field'>
              <Label>{t('workspace.filter.group2')}</Label>
              <Select
                value={workDialog?.type ?? 'image'}
                onValueChange={(v) =>
                  setWorkDialog((prev) =>
                    prev ? { ...prev, type: v === 'video' ? 'video' : 'image' } : prev
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='image'>
                    {t('workspace.filter.image')}
                  </SelectItem>
                  <SelectItem value='video'>
                    {t('workspace.filter.video')}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className='wk-field'>
              <Label>{t('workspace.work.project')}</Label>
              <Select
                value={workDialog?.projectId ?? '0'}
                onValueChange={(v) =>
                  setWorkDialog((prev) =>
                    prev ? { ...prev, projectId: String(v ?? '0') } : prev
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='0'>{t('workspace.work.noProject')}</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className='wk-field'>
            <Label>{t('workspace.work.coverUrl')}</Label>
            <Input
              value={workDialog?.cover ?? ''}
              onChange={(e) =>
                setWorkDialog((prev) =>
                  prev ? { ...prev, cover: e.target.value } : prev
                )
              }
              placeholder='https://...'
            />
          </div>
          <div className='wk-field'>
            <Label>{t('workspace.work.mediaUrl')}</Label>
            <Input
              value={workDialog?.mediaUrl ?? ''}
              onChange={(e) =>
                setWorkDialog((prev) =>
                  prev ? { ...prev, mediaUrl: e.target.value } : prev
                )
              }
              placeholder='https://...'
            />
          </div>
          <div className='wk-field'>
            <Label>{t('workspace.work.prompt')}</Label>
            <Textarea
              rows={2}
              value={workDialog?.prompt ?? ''}
              onChange={(e) =>
                setWorkDialog((prev) =>
                  prev ? { ...prev, prompt: e.target.value } : prev
                )
              }
            />
          </div>
          <DialogFooter>
            <Button variant='outline' onClick={() => setWorkDialog(null)}>
              {t('Cancel')}
            </Button>
            <Button onClick={submitWork}>{t('Save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 预览 */}
      <Dialog open={preview != null} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className='wk-dialog wk-dialog-preview'>
          <DialogHeader>
            <DialogTitle>{preview?.title}</DialogTitle>
          </DialogHeader>
          {preview &&
            (preview.type === 'video' ? (
              <video
                src={parseMedia(preview.media)[0] || preview.cover}
                controls
                className='wk-preview-media'
              />
            ) : (
              <img
                src={parseMedia(preview.media)[0] || preview.cover}
                alt={preview.title}
                className='wk-preview-media'
              />
            ))}
          {preview?.prompt && (
            <p className='wk-preview-prompt'>{preview.prompt}</p>
          )}
        </DialogContent>
      </Dialog>

      {/* 删除确认 */}
      <Dialog
        open={confirmDelete != null}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
      >
        <DialogContent className='wk-dialog'>
          <DialogHeader>
            <DialogTitle>{t('workspace.delete.title')}</DialogTitle>
          </DialogHeader>
          <p className='wk-delete-text'>
            {confirmDelete?.kind === 'project'
              ? t('workspace.delete.projectBody', { name: confirmDelete?.name ?? '' })
              : t('workspace.delete.workBody', { name: confirmDelete?.name ?? '' })}
          </p>
          <DialogFooter>
            <Button variant='outline' onClick={() => setConfirmDelete(null)}>
              {t('Cancel')}
            </Button>
            <Button variant='destructive' onClick={doConfirmDelete}>
              {t('Delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}

function CardMenu(props: {
  onEdit: () => void
  onDelete: () => void
  onMove?: (projectId: number) => void
  projects?: GalleryProject[]
}) {
  const { t } = useTranslation()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type='button'
            className='wk-card-menu'
            aria-label={t('More')}
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal size={15} />
          </button>
        }
      />
      <DropdownMenuContent align='end' onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onClick={props.onEdit}>
          <Pencil size={13} />
          {t('Edit')}
        </DropdownMenuItem>
        {props.onMove && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel>{t('workspace.work.moveTo')}</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => props.onMove?.(0)}>
                <FolderInput size={13} />
                {t('workspace.work.noProject')}
              </DropdownMenuItem>
              {(props.projects ?? []).map((p) => (
                <DropdownMenuItem key={p.id} onClick={() => props.onMove?.(p.id)}>
                  <FolderInput size={13} />
                  {p.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={props.onDelete} className='text-destructive'>
          <Trash2 size={13} />
          {t('Delete')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
