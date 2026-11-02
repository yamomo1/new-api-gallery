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
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'

import {
  SettingsForm,
  SettingsSwitchItem,
} from '../components/settings-form-layout'

/**
 * 统一定价页的字段组件。
 *
 * 所有字段都只依赖 react-hook-form 的 control，不持有自己的状态，
 * 这样同一套骨架既能渲染数字、文本，也能渲染大段 JSON。
 */

type BaseFieldProps = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: any
  name: string
  label: string
  description?: string
  disabled?: boolean
}

export function PricingNumberField({
  control,
  name,
  label,
  description,
  disabled,
  unit,
  step = 'any',
  min,
  max,
  placeholder,
}: BaseFieldProps & {
  unit?: string
  step?: string
  min?: number
  max?: number
  placeholder?: string
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <div className='relative'>
              <Input
                type='number'
                inputMode='decimal'
                step={step}
                min={min}
                max={max}
                placeholder={placeholder}
                disabled={disabled}
                className={unit ? 'pr-14' : undefined}
                {...field}
                onChange={(event) => {
                  // 允许清空输入，否则用户无法重置后重填
                  field.onChange(
                    event.target.value === ''
                      ? ''
                      : Number(event.target.value)
                  )
                }}
              />
              {unit && (
                <span className='text-muted-foreground pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs'>
                  {unit}
                </span>
              )}
            </div>
          </FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

export function PricingTextField({
  control,
  name,
  label,
  description,
  disabled,
  placeholder,
}: BaseFieldProps & { placeholder?: string }) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input
              placeholder={placeholder}
              disabled={disabled}
              {...field}
              value={field.value ?? ''}
            />
          </FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

export function PricingJsonField({
  control,
  name,
  label,
  description,
  disabled,
  rows = 6,
  hint,
}: BaseFieldProps & { rows?: number; hint?: string }) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <div className='flex flex-wrap items-baseline justify-between gap-2'>
            <FormLabel className='font-mono text-[12.5px]'>{label}</FormLabel>
            {hint && (
              <span className='text-muted-foreground text-xs tabular-nums'>
                {hint}
              </span>
            )}
          </div>
          <FormControl>
            <Textarea
              rows={rows}
              spellCheck={false}
              disabled={disabled}
              className='min-h-24 resize-y font-mono text-[12.5px] leading-[1.6]'
              {...field}
              value={field.value ?? ''}
            />
          </FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

export function PricingSwitchField({
  control,
  name,
  label,
  description,
  disabled,
}: BaseFieldProps) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <SettingsSwitchItem>
          <div className='space-y-1'>
            <FormLabel>{label}</FormLabel>
            {description && <FormDescription>{description}</FormDescription>}
          </div>
          <FormControl>
            <Switch
              checked={Boolean(field.value)}
              disabled={disabled}
              onCheckedChange={(checked) => field.onChange(checked)}
            />
          </FormControl>
        </SettingsSwitchItem>
      )}
    />
  )
}

/** 只读信息块：用于展示「当前生效口径」这类派生值 */
export function PricingReadout({
  items,
}: {
  items: { label: string; value: string; tone?: 'default' | 'good' | 'warn' }[]
}) {
  const toneClass = {
    default: 'text-foreground',
    good: 'text-emerald-600 dark:text-emerald-400',
    warn: 'text-amber-600 dark:text-amber-400',
  }
  return (
    <div className='bg-muted/40 grid gap-4 rounded-2xl px-5 py-4 sm:grid-cols-2 lg:grid-cols-4'>
      {items.map((item) => (
        <div key={item.label} className='min-w-0'>
          <div className='text-muted-foreground text-xs'>{item.label}</div>
          <div
            className={`mt-1 truncate text-[15px] font-semibold tabular-nums ${toneClass[item.tone ?? 'default']}`}
            title={item.value}
          >
            {item.value}
          </div>
        </div>
      ))}
    </div>
  )
}

/** 任意合法 JSON（对象或数组）校验：返回错误信息或 null */
export function checkJson(value: string): string | null {
  const trimmed = (value ?? '').trim()
  if (!trimmed) return null
  try {
    JSON.parse(trimmed)
    return null
  } catch (error) {
    return error instanceof Error ? error.message : 'Invalid JSON'
  }
}

/** 只接受 JSON 对象（不含数组）的校验 */
export function checkJsonObject(value: string): string | null {
  const trimmed = (value ?? '').trim()
  if (!trimmed) return null
  try {
    const parsed = JSON.parse(trimmed)
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return 'Must be a JSON object'
    }
    return null
  } catch (error) {
    return error instanceof Error ? error.message : 'Invalid JSON'
  }
}

export { Form, SettingsForm }
