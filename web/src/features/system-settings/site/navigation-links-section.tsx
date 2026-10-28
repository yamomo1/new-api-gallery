/*
 * 二开：站点设置 → 导航链接（顶部导航 / 侧边栏自定义链接）
 *
 * 维护一个 JSON 配置存进 OptionMap["NavCustomLinks"]：
 *   { top: CustomNavLink[], sidebar: CustomNavLink[] }
 * 提供「预设快捷选择」直接把已开发功能地址填进来，也支持完全自定义的链接。
 */
import { useEffect, useMemo, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  ExternalLink,
  Plus,
  Trash2,
} from 'lucide-react'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SettingsSection } from '../components/settings-section'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { useUpdateOption } from '../hooks/use-update-option'
import {
  type CustomNavLink,
  type NavCustomLinksConfig,
  NAV_LINK_PRESETS,
  SIDEBAR_GROUP_OPTIONS,
  SIDEBAR_ROLE_OPTIONS,
  newNavLinkId,
  parseNavCustomLinks,
  serializeNavCustomLinks,
} from '@/lib/nav-custom-links'

type GroupKey = 'top' | 'sidebar'

function emptyLink(group: GroupKey): CustomNavLink {
  return {
    id: newNavLinkId(),
    title: '',
    url: '',
    enabled: true,
    ...(group === 'sidebar' ? { icon: 'frame', group: 'custom' } : {}),
  }
}

function LinkRow({
  group,
  link,
  index,
  total,
  onChange,
  onMove,
  onRemove,
}: {
  group: GroupKey
  link: CustomNavLink
  index: number
  total: number
  onChange: (next: CustomNavLink) => void
  onMove: (dir: -1 | 1) => void
  onRemove: () => void
}) {
  const { t } = useTranslation()
  return (
    <div className='border-border bg-muted/30 flex flex-col gap-2 rounded-lg border p-3'>
      <div className='grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]'>
        <div className='flex flex-col gap-1'>
          <Label className='text-xs'>{t('Title')}</Label>
          <Input
            value={link.title}
            placeholder={link.titleKey ? t(link.titleKey) : t('Link title')}
            onChange={(e) => onChange({ ...link, title: e.target.value })}
          />
        </div>
        <div className='flex flex-col gap-1'>
          <Label className='text-xs'>{t('URL')}</Label>
          <Input
            value={link.url}
            placeholder='/workspace 或 https://example.com'
            onChange={(e) => onChange({ ...link, url: e.target.value })}
          />
        </div>
        <div className='flex items-end gap-1'>
          <Button
            type='button'
            size='icon'
            variant='outline'
            className='size-8'
            disabled={index === 0}
            onClick={() => onMove(-1)}
            aria-label={t('Move up')}
          >
            <ArrowUp />
          </Button>
          <Button
            type='button'
            size='icon'
            variant='outline'
            className='size-8'
            disabled={index === total - 1}
            onClick={() => onMove(1)}
            aria-label={t('Move down')}
          >
            <ArrowDown />
          </Button>
          <Button
            type='button'
            size='icon'
            variant='outline'
            className='text-destructive size-8'
            onClick={onRemove}
            aria-label={t('Remove')}
          >
            <Trash2 />
          </Button>
        </div>
      </div>
      <div className='flex flex-wrap items-center gap-4'>
        <label className='flex items-center gap-2 text-sm'>
          <Switch
            checked={link.enabled}
            onCheckedChange={(v) => onChange({ ...link, enabled: v })}
          />
          {t('Enabled')}
        </label>
        <label className='flex items-center gap-2 text-sm'>
          <Switch
            checked={!!link.requireAuth}
            onCheckedChange={(v) => onChange({ ...link, requireAuth: v })}
          />
          {t('Require login')}
        </label>
        {group === 'top' && (
          <label className='flex items-center gap-2 text-sm'>
            <Switch
              checked={!!link.external}
              onCheckedChange={(v) => onChange({ ...link, external: v })}
            />
            <ExternalLink className='size-3.5' />
            {t('Open in new tab')}
          </label>
        )}
      </div>

      {group === 'sidebar' && (
        <div className='flex flex-wrap items-end gap-3'>
          <div className='flex min-w-40 flex-col gap-1'>
            <Label className='text-xs'>{t('Sidebar group')}</Label>
            <Select
              value={link.group ?? 'custom'}
              onValueChange={(v) =>
                onChange({ ...link, group: v as CustomNavLink['group'] })
              }
            >
              <SelectTrigger className='h-9'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SIDEBAR_GROUP_OPTIONS.map((opt) => (
                  <SelectItem key={opt.id} value={opt.id}>
                    {t(opt.titleKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className='flex min-w-40 flex-col gap-1'>
            <Label className='text-xs'>{t('Visible to')}</Label>
            <Select
              value={String(link.requiredRole ?? 'everyone')}
              onValueChange={(v) =>
                onChange({
                  ...link,
                  requiredRole:
                    v === 'everyone' ? undefined : Number(v),
                })
              }
            >
              <SelectTrigger className='h-9'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SIDEBAR_ROLE_OPTIONS.map((opt) => (
                  <SelectItem
                    key={String(opt.value ?? 'everyone')}
                    value={String(opt.value ?? 'everyone')}
                  >
                    {t(opt.titleKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
    </div>
  )
}

function GroupEditor({
  group,
  config,
  setConfig,
}: {
  group: GroupKey
  config: NavCustomLinksConfig
  setConfig: (next: NavCustomLinksConfig) => void
}) {
  const { t } = useTranslation()
  const list = config[group]

  const update = (next: CustomNavLink[]) => setConfig({ ...config, [group]: next })

  const setItem = (idx: number, next: CustomNavLink) => {
    const copy = list.slice()
    copy[idx] = next
    update(copy)
  }
  const removeItem = (idx: number) => update(list.filter((_, i) => i !== idx))
  const moveItem = (idx: number, dir: -1 | 1) => {
    const target = idx + dir
    if (target < 0 || target >= list.length) return
    const copy = list.slice()
    const [item] = copy.splice(idx, 1)
    copy.splice(target, 0, item)
    update(copy)
  }
  const addEmpty = () => update([...list, emptyLink(group)])
  const addPreset = (presetId: string) => {
    const preset = NAV_LINK_PRESETS.find((p) => p.id === presetId)
    if (!preset) return
    update([
      ...list,
      {
        id: newNavLinkId(),
        title: t(preset.titleKey),
        titleKey: preset.titleKey,
        url: preset.url,
        enabled: true,
        requireAuth: preset.requireAuth,
        ...(group === 'sidebar' ? { icon: preset.icon ?? 'frame' } : {}),
      },
    ])
  }

  return (
    <div className='flex flex-col gap-3'>
      <div className='flex flex-wrap items-center gap-2'>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button size='sm' variant='outline'>
                <Plus data-icon='inline-start' />
                <span>{t('Add preset link')}</span>
              </Button>
            }
          />
          <DropdownMenuContent align='start' className='max-h-80 overflow-auto'>
            {NAV_LINK_PRESETS.map((p) => (
              <DropdownMenuItem
                key={p.id}
                render={
                  <button type='button' onClick={() => addPreset(p.id)}>
                    <span>{t(p.titleKey)}</span>
                    <span className='text-muted-foreground ml-auto pl-4 text-xs'>
                      {p.url}
                    </span>
                  </button>
                }
              />
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Button size='sm' variant='ghost' onClick={addEmpty}>
          <Plus data-icon='inline-start' />
          <span>{t('Add custom link')}</span>
        </Button>
      </div>

      {list.length === 0 ? (
        <p className='text-muted-foreground text-sm'>{t('No custom links yet.')}</p>
      ) : (
        <div className='flex flex-col gap-2'>
          {list.map((link, idx) => (
            <LinkRow
              key={link.id}
              group={group}
              link={link}
              index={idx}
              total={list.length}
              onChange={(next) => setItem(idx, next)}
              onMove={(dir) => moveItem(idx, dir)}
              onRemove={() => removeItem(idx)}
            />
          ))}
        </div>
      )}
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
    () => parseNavCustomLinks(initialSerialized),
    [initialSerialized]
  )
  const [config, setConfig] = useState<NavCustomLinksConfig>(initialConfig)

  useEffect(() => {
    setConfig(initialConfig)
  }, [initialConfig])

  const serialized = serializeNavCustomLinks(config)
  const dirty = serialized !== initialSerialized

  const onSubmit = async () => {
    if (!dirty) return
    await updateOption.mutateAsync({
      key: 'NavCustomLinks',
      value: serialized,
    })
  }

  const resetToDefault = () =>
    setConfig({ top: [], sidebar: [] })

  return (
    <SettingsSection title={t('Navigation links')}>
      <SettingsPageFormActions
        onSave={onSubmit}
        onReset={resetToDefault}
        isSaving={updateOption.isPending}
        isSaveDisabled={!dirty}
        resetLabel='Clear all'
        saveLabel='Save links'
      />

      <div className='flex flex-col gap-6'>
        <div className='flex flex-col gap-2'>
          <h4 className='text-sm font-semibold'>{t('Top navigation')}</h4>
          <p className='text-muted-foreground text-xs'>
            {t('Links shown in the site header next to Home / Console.')}
          </p>
          <GroupEditor group='top' config={config} setConfig={setConfig} />
        </div>
        <div className='flex flex-col gap-2'>
          <h4 className='text-sm font-semibold'>{t('Sidebar')}</h4>
          <p className='text-muted-foreground text-xs'>
            {t(
              'Custom links are added into the selected sidebar group (Chat / General / Personal / Admin / Fork). Use "Visible to" to restrict a link to a minimum role.'
            )}
          </p>
          <GroupEditor group='sidebar' config={config} setConfig={setConfig} />
        </div>
      </div>
    </SettingsSection>
  )
}
