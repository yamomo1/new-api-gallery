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
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { useQuery } from '@tanstack/react-query'

import {
  CONTENT_LAYOUT_VALUES,
  type ContentLayout,
  DEFAULT_THEME_CUSTOMIZATION,
  resolveThemeFont,
  THEME_FONT_VALUES,
  THEME_PRESET_VALUES,
  THEME_RADIUS_VALUES,
  THEME_SCALE_VALUES,
  type ThemeCustomization,
  type ThemeFont,
  type ThemePreset,
  type ThemeRadius,
  type ThemeScale,
} from '@/lib/theme-customization'
import {
  readThemePreference,
  THEME_STORAGE_KEYS,
  writeThemePreference,
} from '@/lib/theme-storage'
import { statusQueryOptions } from '@/lib/status-query'

function applyAttribute(name: string, value: string | null) {
  if (typeof document === 'undefined') return
  const body = document.body
  if (!body) return
  if (value === null) {
    body.removeAttribute(name)
  } else {
    body.setAttribute(name, value)
  }
}

type ThemeCustomizationContextType = {
  defaults: ThemeCustomization
  customization: ThemeCustomization
  setPreset: (preset: ThemePreset) => void
  setFont: (font: ThemeFont) => void
  setRadius: (radius: ThemeRadius) => void
  setScale: (scale: ThemeScale) => void
  setContentLayout: (contentLayout: ContentLayout) => void
  resetCustomization: () => void
}

// Fallback used when a consumer renders outside the provider (e.g. an error
// route mounted before providers are ready, or stale HMR boundaries). Keeping
// it permissive prevents the whole tree from crashing — the UI just behaves
// like the defaults until the real provider re-mounts.
const FALLBACK_CONTEXT: ThemeCustomizationContextType = {
  defaults: DEFAULT_THEME_CUSTOMIZATION,
  customization: DEFAULT_THEME_CUSTOMIZATION,
  setPreset: () => {},
  setFont: () => {},
  setRadius: () => {},
  setScale: () => {},
  setContentLayout: () => {},
  resetCustomization: () => {},
}

const ThemeCustomizationContext =
  createContext<ThemeCustomizationContextType>(FALLBACK_CONTEXT)

export function ThemeCustomizationProvider(props: {
  children: React.ReactNode
}) {
  // 站点默认主题（后台「站点设置 → 主题外观」下发，经 /api/status 的 theme 字段）
  const { data: statusData } = useQuery(statusQueryOptions)
  const sitePreset = useMemo<ThemePreset | null>(() => {
    const raw = statusData?.theme
    if (typeof raw !== 'string') return null
    return THEME_PRESET_VALUES.has(raw as ThemePreset)
      ? (raw as ThemePreset)
      : null
  }, [statusData])

  const [preset, _setPreset] = useState<ThemePreset>(() =>
    readThemePreference<ThemePreset>(
      THEME_STORAGE_KEYS.preset,
      THEME_PRESET_VALUES,
      DEFAULT_THEME_CUSTOMIZATION.preset
    )
  )
  const [font, _setFont] = useState<ThemeFont>(() =>
    readThemePreference<ThemeFont>(
      THEME_STORAGE_KEYS.font,
      THEME_FONT_VALUES,
      DEFAULT_THEME_CUSTOMIZATION.font
    )
  )
  const [radius, _setRadius] = useState<ThemeRadius>(() =>
    readThemePreference<ThemeRadius>(
      THEME_STORAGE_KEYS.radius,
      THEME_RADIUS_VALUES,
      DEFAULT_THEME_CUSTOMIZATION.radius
    )
  )
  const [scale, _setScale] = useState<ThemeScale>(() =>
    readThemePreference<ThemeScale>(
      THEME_STORAGE_KEYS.scale,
      THEME_SCALE_VALUES,
      DEFAULT_THEME_CUSTOMIZATION.scale
    )
  )
  const [contentLayout, _setContentLayout] = useState<ContentLayout>(() =>
    readThemePreference<ContentLayout>(
      THEME_STORAGE_KEYS.contentLayout,
      CONTENT_LAYOUT_VALUES,
      DEFAULT_THEME_CUSTOMIZATION.contentLayout
    )
  )

  // 站点主题生效：仅当用户未手动选择过 preset 时，才跟随后台下发的站点主题。
  // 用户手动选过（localStorage 有值）则不覆盖。
  useEffect(() => {
    if (!sitePreset) return
    try {
      const raw = window.localStorage.getItem(THEME_STORAGE_KEYS.preset)
      if (raw && THEME_PRESET_VALUES.has(raw as ThemePreset)) return
    } catch {
      /* ignore */
    }
    _setPreset(sitePreset)
  }, [sitePreset])

  // Mirror state to the <body> via data-* attributes so theme-presets.css can
  // override CSS variables at the right cascade layer.
  useEffect(() => {
    applyAttribute(
      'data-theme-preset',
      preset === DEFAULT_THEME_CUSTOMIZATION.preset ? null : preset
    )
  }, [preset])

  // Resolve Auto into the preset font or the browser's sans-serif while
  // keeping an explicit Sans choice distinct from that browser fallback.
  useEffect(() => {
    applyAttribute('data-theme-font', resolveThemeFont(font, preset))
  }, [font, preset])

  useEffect(() => {
    applyAttribute(
      'data-theme-radius',
      radius === DEFAULT_THEME_CUSTOMIZATION.radius ? null : radius
    )
  }, [radius])

  useEffect(() => {
    applyAttribute(
      'data-theme-scale',
      scale === DEFAULT_THEME_CUSTOMIZATION.scale ? null : scale
    )
  }, [scale])

  useEffect(() => {
    applyAttribute('data-theme-content-layout', contentLayout)
  }, [contentLayout])

  const setPreset = useCallback((value: ThemePreset) => {
    _setPreset(value)
    writeThemePreference(
      THEME_STORAGE_KEYS.preset,
      value === DEFAULT_THEME_CUSTOMIZATION.preset ? null : value
    )
  }, [])

  const setFont = useCallback((value: ThemeFont) => {
    _setFont(value)
    writeThemePreference(
      THEME_STORAGE_KEYS.font,
      value === DEFAULT_THEME_CUSTOMIZATION.font ? null : value
    )
  }, [])

  const setRadius = useCallback((value: ThemeRadius) => {
    _setRadius(value)
    writeThemePreference(
      THEME_STORAGE_KEYS.radius,
      value === DEFAULT_THEME_CUSTOMIZATION.radius ? null : value
    )
  }, [])

  const setScale = useCallback((value: ThemeScale) => {
    _setScale(value)
    writeThemePreference(
      THEME_STORAGE_KEYS.scale,
      value === DEFAULT_THEME_CUSTOMIZATION.scale ? null : value
    )
  }, [])

  const setContentLayout = useCallback((value: ContentLayout) => {
    _setContentLayout(value)
    writeThemePreference(
      THEME_STORAGE_KEYS.contentLayout,
      value === DEFAULT_THEME_CUSTOMIZATION.contentLayout ? null : value
    )
  }, [])

  const resetCustomization = useCallback(() => {
    setPreset(DEFAULT_THEME_CUSTOMIZATION.preset)
    setFont(DEFAULT_THEME_CUSTOMIZATION.font)
    setRadius(DEFAULT_THEME_CUSTOMIZATION.radius)
    setScale(DEFAULT_THEME_CUSTOMIZATION.scale)
    setContentLayout(DEFAULT_THEME_CUSTOMIZATION.contentLayout)
  }, [setPreset, setFont, setRadius, setScale, setContentLayout])

  const value = useMemo<ThemeCustomizationContextType>(
    () => ({
      defaults: DEFAULT_THEME_CUSTOMIZATION,
      customization: { preset, font, radius, scale, contentLayout },
      setPreset,
      setFont,
      setRadius,
      setScale,
      setContentLayout,
      resetCustomization,
    }),
    [
      preset,
      font,
      radius,
      scale,
      contentLayout,
      setPreset,
      setFont,
      setRadius,
      setScale,
      setContentLayout,
      resetCustomization,
    ]
  )

  return (
    <ThemeCustomizationContext.Provider value={value}>
      {props.children}
    </ThemeCustomizationContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useThemeCustomization() {
  return useContext(ThemeCustomizationContext)
}
