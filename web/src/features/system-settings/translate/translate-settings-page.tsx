/**
 * 翻译设置（后台 Fork settings → 翻译设置）
 * ------------------------------------------------------------------
 * 把「提示词自动翻译」的全部策略从代码里搬到后台：
 * 走哪个模型、怎么约束大模型、一天免费几次、超出后收多少。
 *
 * 后台要能改的东西必须一次配齐三件事：配置项、可视化说明、在线自测。
 * 少了自测，管理员改完提示词只能让用户去当小白鼠 ——
 * 大模型吃不吃这套约束，跑一次就知道。
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Languages, Loader2, Play, RotateCcw, Save } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { api } from '@/lib/api'
import { formatQuotaWithCurrency } from '@/lib/currency'

type TranslateConfig = {
  enabled: boolean
  model: string
  systemPrompt: string
  userPromptTemplate: string
  temperature: number
  maxChars: number
  dailyLimit: number
  overageEnabled: boolean
  overageQuota: number
  notice: string
}

const DEFAULTS: TranslateConfig = {
  enabled: true,
  model: '',
  systemPrompt: '',
  userPromptTemplate: '',
  temperature: 0.2,
  maxChars: 4000,
  dailyLimit: 10,
  overageEnabled: true,
  overageQuota: 1000,
  notice: '',
}

/** 恢复出厂值：把 systemPrompt/template 留空，后端会补回内置的默认提示词 */
const BUILTIN_MARK = ''

export function TranslateSettingsPage() {
  const { t } = useTranslation()
  const [config, setConfig] = useState<TranslateConfig>(DEFAULTS)
  const [initial, setInitial] = useState<TranslateConfig>(DEFAULTS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // 在线自测
  const [sample, setSample] = useState('你好，帮我翻译一下')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const resp = await api.get('/api/gallery-translate/config')
      const data = (resp.data?.data ?? DEFAULTS) as TranslateConfig
      const normalized: TranslateConfig = { ...DEFAULTS, ...data }
      setConfig(normalized)
      setInitial(normalized)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const dirty = useMemo(
    () => JSON.stringify(config) !== JSON.stringify(initial),
    [config, initial]
  )

  const set = <K extends keyof TranslateConfig>(key: K, value: TranslateConfig[K]) =>
    setConfig((c) => ({ ...c, [key]: value }))

  async function save() {
    setSaving(true)
    try {
      const resp = await api.put('/api/gallery-translate/config', config)
      if (resp.data?.success === false) {
        throw new Error(resp.data?.message || '保存失败')
      }
      const data = (resp.data?.data ?? config) as TranslateConfig
      setConfig((c) => ({ ...c, ...data }))
      setInitial((c) => ({ ...c, ...data }))
      toast.success(t('Settings saved'))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  /** 自测走超管专用通道：不占每日次数、不扣额度，可以放心反复试 */
  async function runTest() {
    if (!sample.trim()) return
    setTesting(true)
    setTestResult('')
    try {
      const resp = await api.post('/pg/translate/test', {
        text: sample,
        model: config.model || undefined,
        system_prompt: config.systemPrompt || undefined,
        user_prompt_template: config.userPromptTemplate || undefined,
      })
      const content = (resp.data as { choices?: Array<{ message?: { content?: string } }> })
        ?.choices?.[0]?.message?.content
      setTestResult(content?.trim() || '（模型没有返回内容）')
    } catch (e) {
      setTestResult(e instanceof Error ? e.message : String(e))
    } finally {
      setTesting(false)
    }
  }

  const costPreview = useMemo(
    () => (config.overageQuota > 0 ? formatQuotaWithCurrency(config.overageQuota) : '-'),
    [config.overageQuota]
  )

  if (loading) {
    return (
      <div className='flex items-center gap-2 py-10 text-sm text-muted-foreground'>
        <Loader2 className='size-4 animate-spin' />
        {t('Loading…')}
      </div>
    )
  }

  return (
    <div className='mx-auto max-w-3xl space-y-6 py-6'>
      <div className='flex items-start justify-between gap-4'>
        <div className='space-y-1'>
          <h1 className='flex items-center gap-2 text-2xl font-semibold'>
            <Languages className='size-5' />
            {t('Translate settings', { defaultValue: '翻译设置' })}
          </h1>
          <p className='text-sm text-muted-foreground'>
            {t(
              'Prompt auto-translation: model, prompt constraints, daily quota and pricing.',
              { defaultValue: '配置投稿页「自动翻译」使用的模型、约束提示词、每日次数与超额计费。' }
            )}
          </p>
        </div>
        <Button onClick={save} disabled={!dirty || saving}>
          {saving ? <Loader2 className='size-4 animate-spin' /> : <Save className='size-4' />}
          {t('Save')}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('Translation model', { defaultValue: '翻译模型' })}</CardTitle>
          <CardDescription>
            {t(
              'Leave empty to auto-pick from the user’s available models. Pinning a cheap model keeps costs predictable.',
              { defaultValue: '留空则自动从用户可用模型里挑。指定一个便宜的模型，成本才可控。' }
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='space-y-1.5'>
            <Label htmlFor='tr-model'>{t('Model', { defaultValue: '模型名' })}</Label>
            <Input
              id='tr-model'
              value={config.model}
              onChange={(e) => set('model', e.target.value)}
              placeholder='gpt-4o-mini'
            />
            <p className='text-xs text-muted-foreground'>
              {t('Must be enabled in at least one channel, otherwise requests fail.', {
                defaultValue: '该模型必须至少在一个渠道里可用，否则调用会失败。',
              })}
            </p>
          </div>
          <div className='grid gap-4 sm:grid-cols-2'>
            <div className='space-y-1.5'>
              <Label htmlFor='tr-temp'>
                {t('Temperature', { defaultValue: '温度' })}
              </Label>
              <Input
                id='tr-temp'
                type='number'
                min={0}
                max={2}
                step={0.1}
                value={config.temperature}
                onChange={(e) => set('temperature', Number(e.target.value) || 0)}
              />
            </div>
            <div className='space-y-1.5'>
              <Label htmlFor='tr-maxchars'>
                {t('Max characters', { defaultValue: '单次最大字符数' })}
              </Label>
              <Input
                id='tr-maxchars'
                type='number'
                min={100}
                max={20000}
                step={100}
                value={config.maxChars}
                onChange={(e) => set('maxChars', Number(e.target.value) || 4000)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('Quota & pricing', { defaultValue: '次数与计费' })}</CardTitle>
          <CardDescription>
            {t(
              'Counted per user per day on the server side. Beyond the free quota each call charges extra from the user balance.',
              {
                defaultValue:
                  '按用户按自然日在服务端统计。超出免费次数后，每次调用从用户余额额外扣费。',
              }
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='flex items-center justify-between'>
            <div>
              <Label>{t('Enable auto translate', { defaultValue: '启用自动翻译' })}</Label>
              <p className='text-xs text-muted-foreground'>
                {t('Turn off to hide the feature immediately.', {
                  defaultValue: '关闭后前台立刻禁用，无需发布。',
                })}
              </p>
            </div>
            <Switch
              checked={config.enabled}
              onCheckedChange={(v) => set('enabled', v)}
            />
          </div>

          <div className='grid gap-4 sm:grid-cols-2'>
            <div className='space-y-1.5'>
              <Label htmlFor='tr-daily'>
                {t('Daily free limit', { defaultValue: '每日免费次数' })}
              </Label>
              <Input
                id='tr-daily'
                type='number'
                min={0}
                step={1}
                value={config.dailyLimit}
                onChange={(e) => set('dailyLimit', Number(e.target.value) || 0)}
              />
              <p className='text-xs text-muted-foreground'>
                {t('0 means unlimited.', { defaultValue: '0 表示不限次数。' })}
              </p>
            </div>
            <div className='space-y-1.5'>
              <Label htmlFor='tr-cost'>
                {t('Charge per extra use', { defaultValue: '超额后每次扣费' })}
              </Label>
              <Input
                id='tr-cost'
                type='number'
                min={0}
                step={100}
                value={config.overageQuota}
                onChange={(e) => set('overageQuota', Number(e.target.value) || 0)}
                disabled={!config.overageEnabled}
              />
              <p className='text-xs text-muted-foreground'>
                ≈ {costPreview} / {t('use', { defaultValue: '次' })}
              </p>
            </div>
          </div>

          <div className='flex items-center justify-between'>
            <div>
              <Label>
                {t('Allow translation after the free limit', {
                  defaultValue: '超出后允许付费继续',
                })}
              </Label>
              <p className='text-xs text-muted-foreground'>
                {t('Users with insufficient balance get a clear “top up” message.', {
                  defaultValue: '余额不足的用户会收到明确的充值提示，而不是莫名失败。',
                })}
              </p>
            </div>
            <Switch
              checked={config.overageEnabled}
              onCheckedChange={(v) => set('overageEnabled', v)}
            />
          </div>

          <div className='space-y-1.5'>
            <Label htmlFor='tr-notice'>
              {t('Notice shown to users', { defaultValue: '前台规则文案' })}
            </Label>
            <Input
              id='tr-notice'
              value={config.notice}
              onChange={(e) => set('notice', e.target.value)}
              placeholder={t('Leave empty to generate from settings', {
                defaultValue: '留空则按上面的设置自动生成',
              })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('Prompt constraints', { defaultValue: '约束提示词' })}</CardTitle>
          <CardDescription>
            {t(
              'Tell the model it must only translate. Most models otherwise start chatting back when the input is short.',
              {
                defaultValue:
                  '明确要求模型「只输出译文」。指令不够硬时，多数模型遇到短句会开始聊天。',
              }
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='space-y-1.5'>
            <div className='flex items-center justify-between'>
              <Label htmlFor='tr-sys'>System prompt</Label>
              <Button
                type='button'
                variant='ghost'
                size='sm'
                className='h-6 gap-1 px-1.5 text-xs'
                onClick={() => set('systemPrompt', BUILTIN_MARK)}
              >
                <RotateCcw className='size-3' />
                {t('Reset to built-in', { defaultValue: '恢复内置' })}
              </Button>
            </div>
            <Textarea
              id='tr-sys'
              value={config.systemPrompt}
              onChange={(e) => set('systemPrompt', e.target.value)}
              rows={12}
              className='font-mono text-xs'
              placeholder={t('Leave empty to use the built-in prompt', {
                defaultValue: '留空则使用内置提示词',
              })}
            />
          </div>
          <div className='space-y-1.5'>
            <Label htmlFor='tr-tpl'>
              {t('Input template', { defaultValue: '原文信封' })}
            </Label>
            <Textarea
              id='tr-tpl'
              value={config.userPromptTemplate}
              onChange={(e) => set('userPromptTemplate', e.target.value)}
              rows={5}
              className='font-mono text-xs'
              placeholder='Translate to English, output only the result:&#10;{text}'
            />
            <p className='text-xs text-muted-foreground'>
              {'{text}'} {t('is replaced with the prompt to translate.', { defaultValue: '会替换成待翻译的原文。' })}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('Try it', { defaultValue: '在线自测' })}</CardTitle>
          <CardDescription>
            {t('Runs as admin: no daily limit, no charge. Change the prompt above, then test here.', {
              defaultValue: '以超管身份运行，不占次数不扣费。改完上面的提示词，直接在这里试效果。',
            })}
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-3'>
          <Textarea
            value={sample}
            onChange={(e) => setSample(e.target.value)}
            rows={2}
            placeholder={t('Text to translate', { defaultValue: '待翻译的文本' })}
          />
          <div className='flex items-center gap-2'>
            <Button onClick={runTest} disabled={testing || !sample.trim()}>
              {testing ? <Loader2 className='size-4 animate-spin' /> : <Play className='size-4' />}
              {t('Run test', { defaultValue: '跑一次' })}
            </Button>
            {testResult && (
              <Badge variant='secondary' className='max-w-full truncate font-mono text-xs'>
                {testResult}
              </Badge>
            )}
          </div>
          <p className='text-xs text-muted-foreground'>
            {t(
              'Save before testing if you want trial values; otherwise the last saved prompt is used.',
              { defaultValue: '未保存的改动不会生效 —— 自测用的是上次保存下来的提示词。' }
            )}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
