/*
 * 二开：站点设置 → 导航链接（顶部导航 / 侧边栏）
 *
 * 维护 Option `NavCustomLinks`（v2 JSON）：
 *   { version: 2, top: NavItemNode[], sidebar: NavItemNode[] }
 * 内置项（首页/画廊/控制台/模型广场/排行榜/文档/关于）与自定义项在同一个有序列表里，
 * 可改「显示名 / 图标 / 跳转地址 / 顺序 / 分组 / 可见角色 / 是否启用」。
 */
import { useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, GripVertical, Lock, Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SettingsSection } from '../components/settings-section'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { useUpdateOption } from '../hooks/use-update-option'
import {
  BUILTIN_NAV_ITEMS,
  NAV_ICON_OPTIONS,
  builtinDef,
  newNavItemId,
  parseNavConfig,
  serializeNavConfig,
  type NavChildNode,
  type NavConfig,
  type NavItemNode,
  type NavSurface,
} from '@/lib/nav-config'

const ROLE_OPTIONS: { value: number | undefined; label: string }[] = [
  { value: undefined, label: '所有人' },
  { value: 1, label: '登录用户' },
  { value: 10, label: '管理员' },
  { value: 100, label: '超级管理员' },
]

function ChildrenEditor({
  items,
  onChange,
}: {
  items: NavChildNode[]
  onChange: (next: NavChildNode[]) => void
}) {
  const { t } = useTranslation()
  const patch = (idx: number, p: Partial<NavChildNode>) => {
    const copy = items.slice()
    copy[idx] = { ...copy[idx], ...p }
    onChange(copy)
  }
  const move = (idx: number, dir: -1 | 1) => {
    const target = idx + dir
    if (target < 0 || target >= items.length) return
    const copy = items.slice()
    const [item] = copy.splice(idx, 1)
    copy.splice(target, 0, item)
    onChange(copy)
  }
  return (
    <div className='border-border/70 ml-3 flex flex-col gap-2 border-l pl-3'>
      {items.map((child, idx) => (
        <div key={child.id} className='flex flex-col gap-1.5'>
          <div className='flex items-center gap-1.5'>
            <Input
              value={child.title}
              className='h-8 flex-1'
              placeholder={t('Sub item title')}
              onChange={(e) => patch(idx, { title: e.target.value })}
            />
            <Input
              value={child.url ?? ''}
              className='h-8 flex-1'
              placeholder='留空 = 暂不跳转'
              onChange={(e) => patch(idx, { url: e.target.value })}
            />
            <Switch
              checked={child.enabled}
              onCheckedChange={(v) => patch(idx, { enabled: v })}
            />
            <Button
              type='button'
              size='icon'
              variant='ghost'
              className='size-7'
              disabled={idx === 0}
              onClick={() => move(idx, -1)}
              aria-label={t('Move up')}
            >
              <ArrowUp />
            </Button>
            <Button
              type='button'
              size='icon'
              variant='ghost'
              className='size-7'
              disabled={idx === items.length - 1}
              onClick={() => move(idx, 1)}
              aria-label={t('Move down')}
            >
              <ArrowDown />
            </Button>
            <Button
              type='button'
              size='icon'
              variant='ghost'
              className='text-destructive size-7'
              onClick={() => onChange(items.filter((c) => c.id !== child.id))}
              aria-label={t('Remove')}
            >
              <Trash2 />
            </Button>
          </div>
        </div>
      ))}
      <Button
        type='button'
        size='sm'
        variant='ghost'
        className='w-fit'
        onClick={() =>
          onChange([
            ...items,
            { id: newNavItemId(), title: '新子项', url: '', enabled: true },
          ])
        }
      >
        <Plus data-icon='inline-start' />
        <span>{t('Add sub item')}</span>
      </Button>
    </div>
  )
}

function ItemRow({
  node,
  surface,
  index,
  total,
  onPatch,
  onMove,
  onRemove,
}: {
  node: NavItemNode
  surface: NavSurface
  index: number
  total: number
  onPatch: (patch: Partial<NavItemNode>) => void
  onMove: (dir: -1 | 1) => void
  onRemove: () => void
}) {
  const { t } = useTranslation()
  const def = builtinDef(node.id)
  const builtin = node.kind === 'builtin'
  const defaultLabel = def ? t(def.titleKey, { defaultValue: def.defaultTitle }) : ''

  return (
    <div
      className={`border-border bg-muted/30 flex flex-col gap-3 rounded-lg border p-3 ${
        node.enabled ? '' : 'opacity-60'
      }`}
    >
      <div className='flex items-center gap-2'>
        <GripVertical className='text-muted-foreground/50 size-4 shrink-0' />
        <span className='text-muted-foreground font-mono text-[11px]'>
          {builtin ? `内置·${node.id}` : '自定义'}
        </span>
        {builtin && <Lock className='text-muted-foreground/60 size-3' />}
        <span className='ml-auto flex items-center gap-1'>
          <Button
            type='button'
            size='icon'
            variant='ghost'
            className='size-7'
            disabled={index === 0}
            onClick={() => onMove(-1)}
            aria-label={t('Move up')}
          >
            <ArrowUp />
          </Button>
          <Button
            type='button'
            size='icon'
            variant='ghost'
            className='size-7'
            disabled={index === total - 1}
            onClick={() => onMove(1)}
            aria-label={t('Move down')}
          >
            <ArrowDown />
          </Button>
          {!builtin && (
            <Button
              type='button'
              size='icon'
              variant='ghost'
              className='text-destructive size-7'
              onClick={onRemove}
              aria-label={t('Remove')}
            >
              <Trash2 />
            </Button>
          )}
        </span>
      </div>

      <div className='grid grid-cols-1 gap-2 md:grid-cols-2'>
        <div className='flex flex-col gap-1'>
          <Label className='text-xs'>{t('Title')}</Label>
          <Input
            value={node.title ?? ''}
            placeholder={defaultLabel}
            onChange={(e) => {
              const title = e.target.value
              // 手写标题即视为「自定义标题」，清掉预设 i18n key，否则永远显示翻译值
              onPatch({ title, ...(title ? { titleKey: undefined } : {}) })
            }}
          />
        </div>
        <div className='flex flex-col gap-1'>
          <Label className='text-xs'>{t('URL')}</Label>
          <Input
            value={node.url ?? ''}
            placeholder={def?.defaultUrl ?? '/path 或 https://example.com'}
            onChange={(e) => onPatch({ url: e.target.value })}
          />
        </div>
      </div>

      <div className='flex flex-wrap items-center gap-4'>
        <label className='flex items-center gap-2 text-sm'>
          <Switch
            checked={node.enabled}
            onCheckedChange={(v) => onPatch({ enabled: v })}
          />
          {t('Enabled')}
        </label>
        <label className='flex items-center gap-2 text-sm'>
          <Switch
            checked={!!node.requireAuth}
            onCheckedChange={(v) => onPatch({ requireAuth: v })}
          />
          {t('Require login')}
        </label>
        <label className='flex items-center gap-2 text-sm'>
          <Switch
            checked={!!node.external}
            onCheckedChange={(v) => onPatch({ external: v })}
          />
          {t('Open in new tab')}
        </label>
      </div>

      {surface === 'sidebar' && (
        <div className='flex flex-wrap items-end gap-3'>
          <div className='flex min-w-40 flex-col gap-1'>
            <Label className='text-xs'>{t('Icon')}</Label>
            <Select
              value={node.icon ?? 'frame'}
              onValueChange={(v) => onPatch({ icon: v ?? undefined })}
            >
              <SelectTrigger className='h-9'>
                <SelectValue>
                  {(v: string | null) =>
                    NAV_ICON_OPTIONS.find((o) => o.id === v)?.label ?? 'Frame'
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {NAV_ICON_OPTIONS.map((opt) => (
                  <SelectItem key={opt.id} value={opt.id}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className='flex min-w-36 flex-col gap-1'>
            <Label className='text-xs'>{t('Sidebar group')}</Label>
            <Select
              value={node.group ?? 'primary'}
              onValueChange={(v) =>
                onPatch({ group: (v ?? 'primary') as NavItemNode['group'] })
              }
            >
              <SelectTrigger className='h-9'>
                <SelectValue>
                  {(v: string | null) =>
                    v === 'secondary' ? '次分组（下）' : '主分组（上）'
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='primary'>主分组（上）</SelectItem>
                <SelectItem value='secondary'>次分组（下）</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className='flex min-w-36 flex-col gap-1'>
            <Label className='text-xs'>{t('Visible to')}</Label>
            <Select
              value={String(node.requiredRole ?? 'everyone')}
              onValueChange={(v) =>
                onPatch({
                  requiredRole:
                    v === 'everyone' || !v ? undefined : Number(v),
                })
              }
            >
              <SelectTrigger className='h-9'>
                <SelectValue>
                  {(v: string | null) =>
                    ROLE_OPTIONS.find(
                      (o) => String(o.value ?? 'everyone') === v
                    )?.label ?? '所有人'
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((opt) => (
                  <SelectItem
                    key={String(opt.value ?? 'everyone')}
                    value={String(opt.value ?? 'everyone')}
                  >
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {surface === 'sidebar' &&
        (node.children?.length ? (
          <div className='flex flex-col gap-1.5'>
            <Label className='text-xs'>
              {t('Sub items')}（有子项时该项变为可展开菜单）
            </Label>
            <ChildrenEditor
              items={node.children}
              onChange={(next) => onPatch({ children: next })}
            />
          </div>
        ) : (
          <Button
            type='button'
            size='sm'
            variant='ghost'
            className='w-fit'
            onClick={() =>
              onPatch({
                children: [
                  { id: newNavItemId(), title: '新子项', url: '', enabled: true },
                ],
              })
            }
          >
            <Plus data-icon='inline-start' />
            <span>{t('Add sub item')}（变成可展开菜单）</span>
          </Button>
        ))}
    </div>
  )
}

function SurfaceEditor({
  surface,
  config,
  setConfig,
}: {
  surface: NavSurface
  config: NavConfig
  setConfig: (next: NavConfig) => void
}) {
  const { t } = useTranslation()
  const list = config[surface]

  const update = (next: NavItemNode[]) => setConfig({ ...config, [surface]: next })
  const patchAt = (idx: number, patch: Partial<NavItemNode>) => {
    const copy = list.slice()
    copy[idx] = { ...copy[idx], ...patch }
    update(copy)
  }
  const move = (idx: number, dir: -1 | 1) => {
    const target = idx + dir
    if (target < 0 || target >= list.length) return
    const copy = list.slice()
    const [item] = copy.splice(idx, 1)
    copy.splice(target, 0, item)
    update(copy)
  }
  const addCustom = () =>
    update([
      ...list,
      {
        id: newNavItemId(),
        kind: 'custom',
        enabled: true,
        title: '',
        url: '',
        ...(surface === 'sidebar'
          ? { icon: 'frame', group: 'primary' as const }
          : {}),
      },
    ])
  const addBuiltin = (id: string) => {
    const def = BUILTIN_NAV_ITEMS.find((b) => b.id === id)
    if (!def) return
    update([
      ...list,
      {
        id: def.id,
        kind: 'builtin',
        enabled: true,
        titleKey: def.titleKey,
        icon: def.icon,
        group: def.group,
        ...(def.requireAuth ? { requireAuth: true } : {}),
        ...(def.children
          ? {
              children: def.children.map((c) => ({
                id: c.id,
                title: c.defaultTitle,
                titleKey: c.titleKey,
                enabled: true,
                ...(c.defaultUrl ? { url: c.defaultUrl } : {}),
              })),
            }
          : {}),
      },
    ])
  }

  const missingBuiltins = BUILTIN_NAV_ITEMS.filter(
    (b) => b.surfaces.includes(surface) && !list.some((n) => n.id === b.id)
  )

  return (
    <div className='flex flex-col gap-3'>
      <div className='flex flex-wrap items-center gap-2'>
        <Button size='sm' variant='outline' onClick={addCustom}>
          <Plus data-icon='inline-start' />
          <span>{t('Add custom link')}</span>
        </Button>
        {missingBuiltins.length > 0 && (
          <Select
            value=''
            onValueChange={(v) => {
              if (v) addBuiltin(v)
            }}
          >
            <SelectTrigger className='h-8 w-52'>
              <SelectValue placeholder={t('Restore builtin link')} />
            </SelectTrigger>
            <SelectContent>
              {missingBuiltins.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {t(b.titleKey, { defaultValue: b.defaultTitle })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <span className='text-muted-foreground ml-auto text-xs'>
          共 {list.length} 项（含已关闭项）
        </span>
      </div>

      <div className='flex flex-col gap-2'>
        {list.map((node, idx) => (
          <ItemRow
            key={node.id}
            node={node}
            surface={surface}
            index={idx}
            total={list.length}
            onPatch={(patch) => patchAt(idx, patch)}
            onMove={(dir) => move(idx, dir)}
            onRemove={() => update(list.filter((n) => n.id !== node.id))}
          />
        ))}
      </div>
    </div>
  )
}

export function NavigationLinksSection({
  initialSerialized,
}: {
  initialSerialized: string
}) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()

  const initialConfig = useMemo(
    () => parseNavConfig(initialSerialized),
    [initialSerialized]
  )
  const [config, setConfig] = useState<NavConfig>(initialConfig)

  useEffect(() => {
    setConfig(initialConfig)
  }, [initialConfig])

  const serialized = serializeNavConfig(config)
  const dirty = serialized !== initialSerialized

  const onSubmit = async () => {
    if (!dirty) return
    await updateOption.mutateAsync({
      key: 'NavCustomLinks',
      value: serialized,
    })
  }

  const resetToDefault = () =>
    setConfig(parseNavConfig(''))

  return (
    <SettingsSection title={t('Navigation links')}>
      <SettingsPageFormActions
        onSave={onSubmit}
        onReset={resetToDefault}
        isSaving={updateOption.isPending}
        isSaveDisabled={!dirty}
        resetLabel='恢复默认'
        saveLabel='保存导航'
      />

      <p className='text-muted-foreground text-sm'>
        顶部导航与侧边栏的显示内容、顺序、名称、图标、跳转地址都在此处维护。
        关闭（Enabled 关掉）后该项立刻从对应位置消失，但配置保留，随时可再打开；
        删除内置项会把它从列表移除，可用「恢复内置项」重新加回。
      </p>

      <Tabs defaultValue='sidebar' className='mt-2'>
        <TabsList>
          <TabsTrigger value='sidebar'>侧边栏</TabsTrigger>
          <TabsTrigger value='top'>顶部导航</TabsTrigger>
        </TabsList>
        <TabsContent value='sidebar' className='mt-3'>
          <SurfaceEditor surface='sidebar' config={config} setConfig={setConfig} />
        </TabsContent>
        <TabsContent value='top' className='mt-3'>
          <SurfaceEditor surface='top' config={config} setConfig={setConfig} />
        </TabsContent>
      </Tabs>
    </SettingsSection>
  )
}
