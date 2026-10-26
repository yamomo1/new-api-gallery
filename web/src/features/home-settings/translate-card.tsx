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

/**
 * 自动翻译卡片（二开设置 → 首页设置）
 * ------------------------------------------------------------------
 * 用「本站自己的模型」（/pg/chat/completions，OpenAI 兼容）把源语种的
 * 首页文案翻译成目标语种，只填入目标语种里「还空着」的字段，不覆盖已有译文。
 * 这样用户可以在简体中文里填完，一键铺到其余 6 个语种，手动只需微调。
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Languages, Loader2, WandSparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { api } from '@/lib/api'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  HOME_LOCALE_LABELS,
  HOME_LOCALES,
} from '@/features/gallery-home/locales'
import { TEXT_FIELD_PATHS } from './field-groups'

type Cfg = Record<string, unknown>

function getPath(obj: unknown, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>(
      (acc, k) => (acc && typeof acc === 'object' ? (acc as Cfg)[k] : undefined),
      obj,
    )
}

function isFilled(v: unknown): boolean {
  if (v === undefined || v === null || v === '') return false
  if (Array.isArray(v)) return v.some((x) => x !== '' && x !== null && x !== undefined)
  return true
}

function isPlainObj(v: unknown): v is Cfg {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

/** 把字段值规范成「可翻译」的字符串：标量直接取，数组用换行拼接 */
function toTranslatable(v: unknown): string | null {
  if (v === undefined || v === null) return null
  if (Array.isArray(v)) {
    const items = v
      .map((x) => String(x ?? '').trim())
      .filter(Boolean)
    return items.length ? items.join('\n') : null
  }
  const s = String(v).trim()
  return s ? s : null
}

/** 按源字段的类型，把译文写回（数组则按换行拆回） */
function applyTranslated(sourceType: unknown, translated: string): unknown {
  if (Array.isArray(sourceType)) {
    return translated
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
  }
  return translated
}

/** 非流式调用本站模型翻译一段文案，返回纯文本 */
async function llmTranslate(
  model: string,
  sourceLang: string,
  targetLang: string,
  fields: Record<string, string>,
  signal?: AbortSignal,
): Promise<Record<string, string>> {
  const system =
    `You are a professional web-localization translator. ` +
    `Translate the JSON values from "${sourceLang}" to "${targetLang}". ` +
    `Rules: keep the exact same JSON keys; translate every value; preserve line breaks and commas as given; ` +
    `do not add, remove, or renumber any key; output ONLY a valid JSON object, no markdown, no explanation.`
  const user = `Translate these fields to ${targetLang}:\n${JSON.stringify(fields, null, 2)}`
  const res = await api.post(
    '/pg/chat/completions',
    {
      model,
      stream: false,
      temperature: 0.2,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    },
    { signal, skipErrorHandler: true } as Record<string, unknown>,
  )
  const body = res.data as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const raw = body?.choices?.[0]?.message?.content ?? ''
  // 模型偶尔会包一层 ```json …```，剥掉围栏
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
  const parsed = JSON.parse(cleaned) as Record<string, unknown>
  if (!isPlainObj(parsed)) throw new Error('bad translation payload')
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(fields)) {
    const tv = parsed[k]
    out[k] = typeof tv === 'string' ? tv : Array.isArray(tv) ? tv.join('\n') : v
  }
  return out
}

interface TranslateCardProps {
  /** 各语种当前已填的文案桶（draft.locales） */
  locales: Record<string, Cfg>
  /** 当前正在编辑的语种（作为源语种默认值） */
  currentLang: string
  /** 写回某个语种的某个字段（空串=清除） */
  writeField: (locale: string, path: string, value: unknown) => void
  /** 标记为未保存 */
  markDirty: () => void
}

export function TranslateCard({
  locales,
  currentLang,
  writeField,
  markDirty,
}: TranslateCardProps) {
  const { t } = useTranslation()
  const [source, setSource] = useState<string>(currentLang)
  const [target, setTarget] = useState<string>(
    HOME_LOCALES.find((l) => l !== currentLang) ?? currentLang,
  )
  const [models, setModels] = useState<string[]>([])
  const [model, setModel] = useState('')
  const [busy, setBusy] = useState(false)

  // 拉取本站可用模型
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const { data } = await api.get('/api/user/models')
        if (!alive) return
        const list: string[] = Array.isArray(data?.data) ? data.data : []
        setModels(list)
        if (list.length && !model) setModel(list[0])
      } catch {
        /* 拉不到模型就留空，按钮会禁用并提示 */
      }
    })()
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 源语种里「有内容」的字段（自身值，不含回退），作为翻译输入
  const sourceFields = useMemo(() => {
    const bucket = locales[source] ?? {}
    const out: Record<string, string> = {}
    for (const path of TEXT_FIELD_PATHS) {
      const s = toTranslatable(getPath(bucket, path))
      if (s) out[path] = s
    }
    return out
  }, [locales, source])

  const targetEmptyCount = useMemo(
    () =>
      TEXT_FIELD_PATHS.filter((p) => {
        const tv = getPath(locales[target] ?? {}, p)
        return !isFilled(tv)
      }).length,
    [locales, target],
  )

  const runTranslate = useCallback(async () => {
    if (!model || !Object.keys(sourceFields).length) return
    setBusy(true)
    const controller = new AbortController()
    try {
      const labels = {
        source: HOME_LOCALE_LABELS[source] ?? source,
        target: HOME_LOCALE_LABELS[target] ?? target,
      }
      const translated = await llmTranslate(
        model,
        labels.source,
        labels.target,
        sourceFields,
        controller.signal,
      )
      let filled = 0
      for (const [path, value] of Object.entries(translated)) {
        const current = getPath(locales[target] ?? {}, path)
        if (isFilled(current)) continue // 只填空的，不覆盖
        const sourceType = getPath(locales[source] ?? {}, path)
        writeField(target, path, applyTranslated(sourceType, value))
        filled += 1
      }
      markDirty()
      if (filled > 0)
        toast.success(t('{{n}} fields translated to {{target}}', { n: filled, target: labels.target }))
      else toast.success(t('Target language already complete, nothing to fill'))
    } catch (e: unknown) {
      if ((e as Error)?.name === 'AbortError') return
      toast.error(t('Translation failed, check the model or try again'))
    } finally {
      setBusy(false)
    }
  }, [model, sourceFields, target, locales, source, writeField, markDirty, t])

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <WandSparkles className="size-4 text-primary" />
          <CardTitle className="text-base">
            {t('Auto-translate (LLM)')}
          </CardTitle>
        </div>
        <CardDescription>
          {t('Auto-translate hint')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label className="text-xs">{t('Source language')}</Label>
            <Select
              value={source}
              onValueChange={(v) => v !== null && setSource(v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HOME_LOCALES.map((l) => (
                  <SelectItem key={l} value={l}>
                    {HOME_LOCALE_LABELS[l] ?? l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t('Target language')}</Label>
            <Select
              value={target}
              onValueChange={(v) => v !== null && setTarget(v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HOME_LOCALES.filter((l) => l !== source).map((l) => (
                  <SelectItem key={l} value={l}>
                    {HOME_LOCALE_LABELS[l] ?? l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t('Model')}</Label>
            <Select
              value={model}
              onValueChange={(v) => v !== null && setModel(v)}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('No model available')} />
              </SelectTrigger>
              <SelectContent>
                {models.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Languages className="size-3.5" />
            {t('Source has')}: {Object.keys(sourceFields).length}
            {' / '}
            {t('Target empty')}: {targetEmptyCount}
          </p>
          <Button
            onClick={runTranslate}
            disabled={busy || !model || !Object.keys(sourceFields).length}
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <WandSparkles className="size-4" />
            )}
            {t('Translate empty fields')}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
