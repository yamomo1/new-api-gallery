import { type ReactNode, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { HardDrive, Loader2, Save } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'

import {
  getOptionValue,
  useSystemOptions,
} from '@/features/system-settings/hooks/use-system-options'
import { useUpdateOption } from '@/features/system-settings/hooks/use-update-option'

const STORAGE_KEYS = [
  'StorageProvider',
  'StorageLocalDir',
  'StorageLocalBaseURL',
  'StorageAliOSSBucket',
  'StorageAliOSSEndpoint',
  'StorageAliOSSAccessKey',
  'StorageAliOSSSecret',
  'StorageAliOSSDomain',
  'StorageQiniuBucket',
  'StorageQiniuAccessKey',
  'StorageQiniuSecretKey',
  'StorageQiniuDomain',
  'StorageQiniuRegion',
  'StorageS3Bucket',
  'StorageS3Endpoint',
  'StorageS3Region',
  'StorageS3AccessKey',
  'StorageS3Secret',
  'StorageS3Domain',
  // 海外镜像（国内/国外双写，前端按用户地域择优展示）
  'StorageOverseasEnabled',
  'StorageOverseasProvider',
  'StorageOverseasAliOSSBucket',
  'StorageOverseasAliOSSEndpoint',
  'StorageOverseasAliOSSAccessKey',
  'StorageOverseasAliOSSSecret',
  'StorageOverseasAliOSSDomain',
  'StorageOverseasQiniuBucket',
  'StorageOverseasQiniuAccessKey',
  'StorageOverseasQiniuSecretKey',
  'StorageOverseasQiniuDomain',
  'StorageOverseasQiniuRegion',
  'StorageOverseasS3Bucket',
  'StorageOverseasS3Endpoint',
  'StorageOverseasS3Region',
  'StorageOverseasS3AccessKey',
  'StorageOverseasS3Secret',
  'StorageOverseasS3Domain',
] as const

type StorageMap = Record<(typeof STORAGE_KEYS)[number], string>

const DEFAULTS: StorageMap = {
  StorageProvider: 'local',
  StorageLocalDir: '/data/uploads',
  StorageLocalBaseURL: '/storage/static',
  StorageAliOSSBucket: '',
  StorageAliOSSEndpoint: '',
  StorageAliOSSAccessKey: '',
  StorageAliOSSSecret: '',
  StorageAliOSSDomain: '',
  StorageQiniuBucket: '',
  StorageQiniuAccessKey: '',
  StorageQiniuSecretKey: '',
  StorageQiniuDomain: '',
  StorageQiniuRegion: 'z2',
  StorageS3Bucket: '',
  StorageS3Endpoint: '',
  StorageS3Region: 'auto',
  StorageS3AccessKey: '',
  StorageS3Secret: '',
  StorageS3Domain: '',
  StorageOverseasEnabled: 'false',
  StorageOverseasProvider: 's3',
  StorageOverseasAliOSSBucket: '',
  StorageOverseasAliOSSEndpoint: '',
  StorageOverseasAliOSSAccessKey: '',
  StorageOverseasAliOSSSecret: '',
  StorageOverseasAliOSSDomain: '',
  StorageOverseasQiniuBucket: '',
  StorageOverseasQiniuAccessKey: '',
  StorageOverseasQiniuSecretKey: '',
  StorageOverseasQiniuDomain: '',
  StorageOverseasQiniuRegion: 'na0',
  StorageOverseasS3Bucket: '',
  StorageOverseasS3Endpoint: '',
  StorageOverseasS3Region: 'auto',
  StorageOverseasS3AccessKey: '',
  StorageOverseasS3Secret: '',
  StorageOverseasS3Domain: '',
}

const PROVIDER_OPTIONS = [
  { value: 'local', labelKey: 'storage.local' },
  { value: 'alioss', label: '阿里云 OSS' },
  { value: 'qiniu', label: '七牛云 Kodo' },
  { value: 's3', labelKey: 'storage.s3' },
] as const

export function StorageSettingsPage() {
  const { t } = useTranslation()
  const { data: optionsResp, isLoading } = useSystemOptions()
  const options = optionsResp?.data
  const updateOption = useUpdateOption()
  const [form, setForm] = useState<StorageMap>(DEFAULTS)
  const [saving, setSaving] = useState(false)

  const initial = useMemo(
    () => getOptionValue(options, DEFAULTS as StorageMap),
    [options],
  )
  useEffect(() => {
    if (options) setForm(getOptionValue(options, DEFAULTS as StorageMap))
  }, [options, initial])

  const set = (k: (typeof STORAGE_KEYS)[number], v: string) =>
    setForm((f) => ({ ...f, [k]: v }))

  async function save() {
    setSaving(true)
    try {
      for (const k of STORAGE_KEYS) {
        if (form[k] !== initial[k]) {
          await updateOption.mutateAsync({ key: k, value: form[k] })
        }
      }
      toast.success(t('Settings saved'))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className='flex justify-center p-16'>
        <Loader2 className='size-6 animate-spin text-muted-foreground' />
      </div>
    )
  }

  const provider = form.StorageProvider
  const overseasOn = form.StorageOverseasEnabled === 'true'

  return (
    <div className='mx-auto max-w-3xl space-y-6 p-6'>
      <div>
        <h2 className='flex items-center gap-2 text-lg font-semibold'>
          <HardDrive className='size-5' />
          {t('storage.title', { defaultValue: '存储设置' })}
        </h2>
        <p className='mt-1 text-sm text-muted-foreground'>
          {t('storage.desc', {
            defaultValue:
              '配置全站图片上传的存储后端。上传接口：POST /api/storage/upload（任意登录用户可调用）。',
          })}
        </p>
      </div>

      <Card>
        <CardHeader className='pb-3'>
          <CardTitle className='text-base'>
            {t('storage.domestic', { defaultValue: '国内主存储' })}
          </CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          <Row label={t('storage.provider', { defaultValue: '存储方式' })}>
            <Select value={provider} onValueChange={(v) => set('StorageProvider', v ?? 'local')}>
              <SelectTrigger className='w-[300px]'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROVIDER_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {'labelKey' in o
                      ? t(o.labelKey, { defaultValue: o.value })
                      : o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Row>

          {provider === 'local' && (
            <>
              <Row label={t('storage.localDir', { defaultValue: '本地目录' })}>
                <Input
                  value={form.StorageLocalDir}
                  onChange={(e) => set('StorageLocalDir', e.target.value)}
                  placeholder='/data/uploads'
                />
              </Row>
              <Row label={t('storage.localBaseUrl', { defaultValue: '访问前缀' })}>
                <Input
                  value={form.StorageLocalBaseURL}
                  onChange={(e) => set('StorageLocalBaseURL', e.target.value)}
                  placeholder='/storage/static'
                />
              </Row>
            </>
          )}

          {provider === 'alioss' && (
            <>
              <Row label='Bucket'>
                <Input
                  value={form.StorageAliOSSBucket}
                  onChange={(e) => set('StorageAliOSSBucket', e.target.value)}
                />
              </Row>
              <Row label='Endpoint'>
                <Input
                  value={form.StorageAliOSSEndpoint}
                  onChange={(e) => set('StorageAliOSSEndpoint', e.target.value)}
                  placeholder='oss-cn-hangzhou.aliyuncs.com'
                />
              </Row>
              <Row label='AccessKeyId'>
                <Input
                  value={form.StorageAliOSSAccessKey}
                  onChange={(e) => set('StorageAliOSSAccessKey', e.target.value)}
                />
              </Row>
              <Row label='AccessKeySecret'>
                <Input
                  type='password'
                  value={form.StorageAliOSSSecret}
                  onChange={(e) => set('StorageAliOSSSecret', e.target.value)}
                />
              </Row>
              <Row label={t('storage.domain', { defaultValue: '访问域名（可选）' })}>
                <Input
                  value={form.StorageAliOSSDomain}
                  onChange={(e) => set('StorageAliOSSDomain', e.target.value)}
                  placeholder='https://cdn.example.com'
                />
              </Row>
            </>
          )}

          {provider === 'qiniu' && (
            <>
              <Row label='Bucket'>
                <Input
                  value={form.StorageQiniuBucket}
                  onChange={(e) => set('StorageQiniuBucket', e.target.value)}
                />
              </Row>
              <Row label='AccessKey'>
                <Input
                  value={form.StorageQiniuAccessKey}
                  onChange={(e) => set('StorageQiniuAccessKey', e.target.value)}
                />
              </Row>
              <Row label='SecretKey'>
                <Input
                  type='password'
                  value={form.StorageQiniuSecretKey}
                  onChange={(e) => set('StorageQiniuSecretKey', e.target.value)}
                />
              </Row>
              <Row label={t('storage.domain', { defaultValue: '访问域名（必填）' })}>
                <Input
                  value={form.StorageQiniuDomain}
                  onChange={(e) => set('StorageQiniuDomain', e.target.value)}
                  placeholder='https://cdn.example.com'
                />
              </Row>
              <Row label={t('storage.region', { defaultValue: '机房' })}>
                <Input
                  value={form.StorageQiniuRegion}
                  onChange={(e) => set('StorageQiniuRegion', e.target.value)}
                  placeholder='z2'
                />
              </Row>
            </>
          )}

          {provider === 's3' && (
            <>
              <Row label='Bucket'>
                <Input
                  value={form.StorageS3Bucket}
                  onChange={(e) => set('StorageS3Bucket', e.target.value)}
                />
              </Row>
              <Row label='Endpoint'>
                <Input
                  value={form.StorageS3Endpoint}
                  onChange={(e) => set('StorageS3Endpoint', e.target.value)}
                  placeholder='https://<id>.r2.cloudflarestorage.com'
                />
              </Row>
              <Row label='Region'>
                <Input
                  value={form.StorageS3Region}
                  onChange={(e) => set('StorageS3Region', e.target.value)}
                  placeholder='auto / us-east-1'
                />
              </Row>
              <Row label='AccessKeyId'>
                <Input
                  value={form.StorageS3AccessKey}
                  onChange={(e) => set('StorageS3AccessKey', e.target.value)}
                />
              </Row>
              <Row label='SecretAccessKey'>
                <Input
                  type='password'
                  value={form.StorageS3Secret}
                  onChange={(e) => set('StorageS3Secret', e.target.value)}
                />
              </Row>
              <Row label={t('storage.domain', { defaultValue: '访问域名（可选）' })}>
                <Input
                  value={form.StorageS3Domain}
                  onChange={(e) => set('StorageS3Domain', e.target.value)}
                  placeholder='https://cdn.example.com'
                />
              </Row>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className='pb-3'>
          <CardTitle className='text-base'>
            {t('storage.overseas.title', { defaultValue: '海外镜像存储' })}
          </CardTitle>
          <p className='mt-1 text-sm text-muted-foreground'>
            {t('storage.overseas.desc', {
              defaultValue:
                '开通后上传会同时写入海外存储（失败不影响主流程），国外用户自动访问海外地址，国内用户不受影响。推荐 Cloudflare R2：零出流量费、全球 CDN。',
            })}
          </p>
        </CardHeader>
        <CardContent className='space-y-4'>
          <Row label={t('storage.overseas.enabled', { defaultValue: '开通海外' })}>
            <Switch
              checked={overseasOn}
              onCheckedChange={(v) =>
                set('StorageOverseasEnabled', v === true ? 'true' : 'false')
              }
            />
          </Row>

          {overseasOn && (
            <>
              <Row
                label={t('storage.overseas.provider', {
                  defaultValue: '海外存储方式',
                })}
              >
                <Select
                  value={form.StorageOverseasProvider}
                  onValueChange={(v) => set('StorageOverseasProvider', v ?? 's3')}
                >
                  <SelectTrigger className='w-[340px]'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='s3'>
                      {t('storage.s3', {
                        defaultValue: 'S3 兼容（R2 / AWS S3 / 腾讯云 COS）',
                      })}
                    </SelectItem>
                    <SelectItem value='qiniu'>
                      七牛云（海外机房 na0/as0）
                    </SelectItem>
                    <SelectItem value='alioss'>阿里云 OSS</SelectItem>
                  </SelectContent>
                </Select>
              </Row>

              {form.StorageOverseasProvider === 's3' && (
                <>
                  <Row label='Bucket'>
                    <Input
                      value={form.StorageOverseasS3Bucket}
                      onChange={(e) =>
                        set('StorageOverseasS3Bucket', e.target.value)
                      }
                    />
                  </Row>
                  <Row
                    label={
                      <>
                        Endpoint
                        <Hint text='R2: https://<account_id>.r2.cloudflarestorage.com' />
                      </>
                    }
                  >
                    <Input
                      value={form.StorageOverseasS3Endpoint}
                      onChange={(e) =>
                        set('StorageOverseasS3Endpoint', e.target.value)
                      }
                      placeholder='https://<account_id>.r2.cloudflarestorage.com'
                    />
                  </Row>
                  <Row
                    label={
                      <>
                        Region
                        <Hint text='R2 / COS 填 auto' />
                      </>
                    }
                  >
                    <Input
                      value={form.StorageOverseasS3Region}
                      onChange={(e) =>
                        set('StorageOverseasS3Region', e.target.value)
                      }
                      placeholder='auto'
                    />
                  </Row>
                  <Row label='AccessKeyId'>
                    <Input
                      value={form.StorageOverseasS3AccessKey}
                      onChange={(e) =>
                        set('StorageOverseasS3AccessKey', e.target.value)
                      }
                    />
                  </Row>
                  <Row label='SecretAccessKey'>
                    <Input
                      type='password'
                      value={form.StorageOverseasS3Secret}
                      onChange={(e) =>
                        set('StorageOverseasS3Secret', e.target.value)
                      }
                    />
                  </Row>
                  <Row
                    label={
                      <>
                        {t('storage.domain', { defaultValue: '访问域名（必填）' })}
                        <Hint text='R2 绑定的自定义域或 r2.dev 公开域，否则前端无法访问' />
                      </>
                    }
                  >
                    <Input
                      value={form.StorageOverseasS3Domain}
                      onChange={(e) =>
                        set('StorageOverseasS3Domain', e.target.value)
                      }
                      placeholder='https://cdn.example.com'
                    />
                  </Row>
                </>
              )}

              {form.StorageOverseasProvider === 'qiniu' && (
                <>
                  <Row label='Bucket'>
                    <Input
                      value={form.StorageOverseasQiniuBucket}
                      onChange={(e) =>
                        set('StorageOverseasQiniuBucket', e.target.value)
                      }
                    />
                  </Row>
                  <Row label='AccessKey'>
                    <Input
                      value={form.StorageOverseasQiniuAccessKey}
                      onChange={(e) =>
                        set('StorageOverseasQiniuAccessKey', e.target.value)
                      }
                    />
                  </Row>
                  <Row label='SecretKey'>
                    <Input
                      type='password'
                      value={form.StorageOverseasQiniuSecretKey}
                      onChange={(e) =>
                        set('StorageOverseasQiniuSecretKey', e.target.value)
                      }
                    />
                  </Row>
                  <Row label={t('storage.domain', { defaultValue: '访问域名（必填）' })}>
                    <Input
                      value={form.StorageOverseasQiniuDomain}
                      onChange={(e) =>
                        set('StorageOverseasQiniuDomain', e.target.value)
                      }
                      placeholder='https://cdn.example.com'
                    />
                  </Row>
                  <Row
                    label={
                      <>
                        {t('storage.region', { defaultValue: '机房' })}
                        <Hint text='海外填 na0（北美）或 as0（东南亚）' />
                      </>
                    }
                  >
                    <Input
                      value={form.StorageOverseasQiniuRegion}
                      onChange={(e) =>
                        set('StorageOverseasQiniuRegion', e.target.value)
                      }
                      placeholder='na0'
                    />
                  </Row>
                </>
              )}

              {form.StorageOverseasProvider === 'alioss' && (
                <>
                  <Row label='Bucket'>
                    <Input
                      value={form.StorageOverseasAliOSSBucket}
                      onChange={(e) =>
                        set('StorageOverseasAliOSSBucket', e.target.value)
                      }
                    />
                  </Row>
                  <Row label='Endpoint'>
                    <Input
                      value={form.StorageOverseasAliOSSEndpoint}
                      onChange={(e) =>
                        set('StorageOverseasAliOSSEndpoint', e.target.value)
                      }
                      placeholder='oss-ap-southeast-1.aliyuncs.com'
                    />
                  </Row>
                  <Row label='AccessKeyId'>
                    <Input
                      value={form.StorageOverseasAliOSSAccessKey}
                      onChange={(e) =>
                        set('StorageOverseasAliOSSAccessKey', e.target.value)
                      }
                    />
                  </Row>
                  <Row label='AccessKeySecret'>
                    <Input
                      type='password'
                      value={form.StorageOverseasAliOSSSecret}
                      onChange={(e) =>
                        set('StorageOverseasAliOSSSecret', e.target.value)
                      }
                    />
                  </Row>
                  <Row label={t('storage.domain', { defaultValue: '访问域名（必填）' })}>
                    <Input
                      value={form.StorageOverseasAliOSSDomain}
                      onChange={(e) =>
                        set('StorageOverseasAliOSSDomain', e.target.value)
                      }
                      placeholder='https://cdn.example.com'
                    />
                  </Row>
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <div className='pb-4'>
        <Button onClick={save} disabled={saving}>
          {saving ? (
            <Loader2 className='size-4 animate-spin' />
          ) : (
            <Save className='size-4' />
          )}
          {t('Save')}
        </Button>
      </div>
    </div>
  )
}

function Hint({ text }: { text: string }) {
  return <span className='block text-xs text-muted-foreground'>{text}</span>
}

function Row({
  label,
  children,
}: {
  label: ReactNode
  children: ReactNode
}) {
  return (
    <div className='grid grid-cols-1 items-center gap-2 sm:grid-cols-[180px_1fr]'>
      <span className='text-sm text-muted-foreground'>{label}</span>
      <div>{children}</div>
    </div>
  )
}
