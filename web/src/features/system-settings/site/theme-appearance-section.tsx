import { useTranslation } from 'react-i18next'
import { Check } from 'lucide-react'

import { cn } from '@/lib/utils'
import { THEME_PRESETS } from '@/lib/theme-customization'

import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'

type ThemeAppearanceSectionProps = {
  defaultValue?: string
}

/**
 * 站点默认主题外观（后台「站点设置 → 主题外观」）。
 *
 * 保存到后端 option key `ThemePreset`，经 `/api/status` 的 `theme` 字段下发；
 * 前端 ThemeCustomizationProvider 在「用户未手动选过 preset」时跟随之，
 * 从而做到一键换肤、全站生效。
 */
export function ThemeAppearanceSection({
  defaultValue,
}: ThemeAppearanceSectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()

  const current = THEME_PRESETS.some((p) => p.value === defaultValue)
    ? defaultValue
    : 'default'

  const handleSelect = async (value: string) => {
    await updateOption.mutateAsync({
      key: 'ThemePreset',
      value,
    })
  }

  return (
    <SettingsSection title={t('Theme appearance')}>
      <p className='text-sm text-muted-foreground'>
        {t(
          'Pick the default color theme for the whole site. Visitors who never picked a theme will see this one.'
        )}
      </p>

      <div className='grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5'>
        {THEME_PRESETS.map((preset) => {
          const active = current === preset.value
          return (
            <button
              key={preset.value}
              type='button'
              onClick={() => handleSelect(preset.value)}
              className={cn(
                'group relative flex flex-col items-center gap-2 rounded-xl border p-3 text-sm transition-colors',
                active
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/40'
              )}
            >
              <span
                className='flex h-10 w-full items-center justify-center overflow-hidden rounded-lg border border-border'
                style={{
                  background: `linear-gradient(120deg, ${preset.swatches[0]}, ${preset.swatches[1]})`,
                }}
              >
                {active && (
                  <Check className='size-5 text-white drop-shadow' strokeWidth={3} />
                )}
              </span>
              <span className='font-medium'>{preset.name}</span>
              {active && (
                <span className='absolute -top-2 -right-2 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground'>
                  {t('Active')}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {updateOption.isPending && (
        <p className='text-xs text-muted-foreground'>{t('Saving…')}</p>
      )}
    </SettingsSection>
  )
}
