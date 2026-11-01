/*
 * 二开：站点设置 → 模型设置
 *
 * 维护 Option `GalleryModelCatalog`（JSON）：
 *   { version: 1, models: [{ id, name, description, tags[], badge, category, icon, enabled }] }
 * 图片模型只在「图片创作」页的模型选择弹窗出现，视频模型只在「视频创作」页出现。
 */
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  MODEL_ICON_KEYS,
  defaultCatalog,
  newModelId,
  parseModelCatalog,
  serializeModelCatalog,
  type CatalogModel,
  type ModelCategory,
} from '@/lib/model-catalog'
import { SettingsSection } from '../components/settings-section'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { useUpdateOption } from '../hooks/use-update-option'

function ModelRow({
  model,
  index,
  total,
  onChange,
  onMove,
  onRemove,
}: {
  model: CatalogModel
  index: number
  total: number
  onChange: (next: CatalogModel) => void
  onMove: (dir: -1 | 1) => void
  onRemove: () => void
}) {
  const { t } = useTranslation()
  return (
    <div
      className={`border-border bg-muted/30 flex flex-col gap-2 rounded-lg border p-3 ${
        model.enabled ? '' : 'opacity-60'
      }`}
    >
      <div className='grid grid-cols-1 gap-2 md:grid-cols-[1fr_1fr_auto]'>
        <div className='flex flex-col gap-1'>
          <Label className='text-xs'>{t('Model name')}</Label>
          <Input
            value={model.name}
            placeholder='智能图片V2'
            onChange={(e) => onChange({ ...model, name: e.target.value })}
          />
        </div>
        <div className='flex flex-col gap-1'>
          <Label className='text-xs'>{t('Description')}</Label>
          <Input
            value={model.description ?? ''}
            placeholder='多参考生成，长文本能力突出'
            onChange={(e) => onChange({ ...model, description: e.target.value })}
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

      <div className='grid grid-cols-1 gap-2 md:grid-cols-[1fr_1fr_auto]'>
        <div className='flex flex-col gap-1'>
          <Label className='text-xs'>{t('Tags')}（逗号分隔）</Label>
          <Input
            value={(model.tags ?? []).join(',')}
            placeholder='多参考图,超清4K'
            onChange={(e) =>
              onChange({
                ...model,
                tags: e.target.value
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
          />
        </div>
        <div className='flex flex-col gap-1'>
          <Label className='text-xs'>{t('Badge')}（留空不显示）</Label>
          <Input
            value={model.badge ?? ''}
            placeholder='NEW / VIP'
            onChange={(e) => onChange({ ...model, badge: e.target.value })}
          />
        </div>
        <label className='flex items-end gap-2 pb-1 text-sm'>
          <Switch
            checked={model.enabled}
            onCheckedChange={(v) => onChange({ ...model, enabled: v })}
          />
          {t('Enabled')}
        </label>
      </div>

      <div className='flex flex-wrap items-center gap-2'>
        <span className='text-muted-foreground text-xs'>图标</span>
        {MODEL_ICON_KEYS.map((key) => (
          <button
            key={key}
            type='button'
            onClick={() => onChange({ ...model, icon: key })}
            className={`rounded-md border px-2 py-0.5 text-xs ${
              (model.icon ?? 'spark') === key
                ? 'border-primary text-primary'
                : 'border-border text-muted-foreground'
            }`}
          >
            {key}
          </button>
        ))}
      </div>
    </div>
  )
}

function CategoryEditor({
  category,
  models,
  setModels,
}: {
  category: ModelCategory
  models: CatalogModel[]
  setModels: (next: CatalogModel[]) => void
}) {
  const { t } = useTranslation()
  const list = models.filter((m) => m.category === category)
  const others = models.filter((m) => m.category !== category)

  const commit = (next: CatalogModel[]) => setModels([...others, ...next])
  const patch = (idx: number, next: CatalogModel) => {
    const copy = list.slice()
    copy[idx] = next
    commit(copy)
  }
  const move = (idx: number, dir: -1 | 1) => {
    const target = idx + dir
    if (target < 0 || target >= list.length) return
    const copy = list.slice()
    const [item] = copy.splice(idx, 1)
    copy.splice(target, 0, item)
    commit(copy)
  }

  return (
    <div className='flex flex-col gap-2'>
      <div className='flex items-center gap-2'>
        <Button
          size='sm'
          variant='outline'
          onClick={() =>
            commit([
              ...list,
              {
                id: newModelId(),
                name: '新模型',
                category,
                enabled: true,
                icon: 'spark',
              },
            ])
          }
        >
          <Plus data-icon='inline-start' />
          <span>{t('Add model')}</span>
        </Button>
        <span className='text-muted-foreground ml-auto text-xs'>
          共 {list.length} 个（含已关闭）
        </span>
      </div>
      {list.length === 0 ? (
        <p className='text-muted-foreground text-sm'>还没有模型，点「添加模型」开始。</p>
      ) : (
        list.map((model, idx) => (
          <ModelRow
            key={model.id}
            model={model}
            index={idx}
            total={list.length}
            onChange={(next) => patch(idx, next)}
            onMove={(dir) => move(idx, dir)}
            onRemove={() => commit(list.filter((m) => m.id !== model.id))}
          />
        ))
      )}
    </div>
  )
}

export function ModelCatalogSection({
  initialSerialized,
}: {
  initialSerialized: string
}) {
  const updateOption = useUpdateOption()
  const initial = useMemo(() => parseModelCatalog(initialSerialized), [initialSerialized])
  const [models, setModels] = useState<CatalogModel[]>(initial.models)

  useEffect(() => {
    setModels(initial.models)
  }, [initial])

  const serialized = serializeModelCatalog({ version: 1, models })
  const dirty = serialized !== initialSerialized

  return (
    <SettingsSection title='模型设置'>
      <SettingsPageFormActions
        onSave={async () => {
          if (!dirty) return
          await updateOption.mutateAsync({
            key: 'GalleryModelCatalog',
            value: serialized,
          })
        }}
        onReset={() => setModels(defaultCatalog().models)}
        isSaving={updateOption.isPending}
        isSaveDisabled={!dirty}
        resetLabel='恢复默认'
        saveLabel='保存模型'
      />

      <p className='text-muted-foreground text-sm'>
        模型分「图片模型 / 视频模型」两类，分别出现在图片创作页与视频创作页的「选择模型」弹窗中。
        关闭的模型不会下发到前端；顺序即弹窗内的展示顺序。
      </p>

      <Tabs defaultValue='image' className='mt-2'>
        <TabsList>
          <TabsTrigger value='image'>图片模型</TabsTrigger>
          <TabsTrigger value='video'>视频模型</TabsTrigger>
        </TabsList>
        <TabsContent value='image' className='mt-3'>
          <CategoryEditor category='image' models={models} setModels={setModels} />
        </TabsContent>
        <TabsContent value='video' className='mt-3'>
          <CategoryEditor category='video' models={models} setModels={setModels} />
        </TabsContent>
      </Tabs>
    </SettingsSection>
  )
}
