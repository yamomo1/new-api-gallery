/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { zodResolver } from '@hookform/resolvers/zod'
import { useState, type ReactNode } from 'react'
import {
  useForm,
  type DefaultValues,
  type FieldValues,
  type Resolver,
} from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import type { z } from 'zod'

import { Form } from '@/components/ui/form'

import { SettingsForm } from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useSystemOptions } from '../hooks/use-system-options'
import { useUpdateOption } from '../hooks/use-update-option'

export type PricingUpdate = { key: string; value: string }

/**
 * 统一定价页的保存外壳。
 *
 * 两个关键约束：
 *  1. **只提交真正变化的键** —— 避免把没碰过的配置重写一遍（JSON 类字段尤其危险）。
 *  2. **保存前复核服务端值** —— 该页与「计费与支付」「模型定价」共用同一批 option，
 *     如果期间有人在原页面改过，这里直接覆盖会静默丢配置，所以先拉最新值比对，
 *     不一致就中止并提示刷新。
 */
export function PricingSectionShell<
  TSchema extends z.ZodType<FieldValues>,
>({
  title,
  schema,
  defaults,
  original,
  toUpdates,
  saveLabel,
  children,
  header,
}: {
  title: string
  schema: TSchema
  defaults: DefaultValues<z.infer<TSchema>>
  original: Record<string, string | number | boolean | unknown[]>
  /** 返回「本分节负责的全部键」→ 期望值；外壳会自动剔除与原始值相同的项 */
  toUpdates: (values: z.infer<TSchema>) => Record<string, string>
  saveLabel: string
  children: (context: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    control: any
    values: z.infer<TSchema>
  }) => ReactNode
  header?: ReactNode
}) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const { refetch } = useSystemOptions()
  const [conflict, setConflict] = useState<string | null>(null)

  const form = useForm<z.infer<TSchema>>({
    resolver: zodResolver(schema as never) as unknown as Resolver<
      z.infer<TSchema>
    >,
    defaultValues: defaults,
  })

  const { isDirty, isSubmitting } = form.formState

  async function onSubmit(values: z.infer<TSchema>) {
    const updates: PricingUpdate[] = Object.entries(toUpdates(values))
      .filter(([key, value]) => String(original[key] ?? '') !== value)
      .map(([key, value]) => ({ key, value }))

    if (updates.length === 0) {
      toast.info(t('No changes to save'))
      return
    }

    // 复核：服务端现值必须仍等于进入页面时的值
    const latest = await refetch()
    const serverMap = new Map<string, string>()
    for (const option of latest.data?.data ?? []) {
      serverMap.set(option.key, option.value)
    }
    for (const update of updates) {
      const serverValue = serverMap.get(update.key)
      const before = original[update.key]
      if (
        serverValue !== undefined &&
        String(before ?? '') !== String(serverValue)
      ) {
        setConflict(update.key)
        toast.error(
          t(
            'This setting was changed elsewhere ({{key}}). Reloaded the latest value — review it before saving again.',
            { key: update.key }
          )
        )
        await refetch()
        return
      }
    }

    setConflict(null)
    try {
      for (const update of updates) {
        await updateOption.mutateAsync(update)
      }
      form.reset(values)
      toast.success(t('Pricing settings saved'))
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t('Failed to save settings')
      )
    }
  }

  const values = form.watch()

  return (
    <SettingsSection title={t(title)}>
      {header}
      <Form {...form}>
        <SettingsForm onSubmit={form.handleSubmit(onSubmit)} autoComplete='off'>
          <SettingsPageFormActions
            onSave={form.handleSubmit(onSubmit)}
            isSaving={updateOption.isPending || isSubmitting}
            isSaveDisabled={!isDirty}
            saveLabel={saveLabel}
          />
          {conflict && (
            <div className='rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-[13px] text-amber-700 dark:text-amber-300'>
              {t(
                'The value of {{key}} changed on the server. Nothing was saved — please review and save again.',
                { key: conflict }
              )}
            </div>
          )}
          <div className='grid gap-5'>
            {children({ control: form.control, values })}
          </div>
        </SettingsForm>
      </Form>
    </SettingsSection>
  )
}
