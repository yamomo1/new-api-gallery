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
import { useForm, type Resolver } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'

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
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'

import {
  SettingsForm,
  SettingsSwitchContent,
  SettingsSwitchItem,
} from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'

/**
 * 支付宝开放平台官方直连设置。
 *
 * 与「支付网关 → Epay」里的支付宝不是一回事：那边走第三方聚合网关，
 * 这里用应用私钥直接向支付宝开放平台下单，走官方的电脑网站 / 手机网站 / 当面付产品。
 * 所有字段都保存为 alipay_setting.* 形式的 option。
 */

export interface AlipayOfficialSettingsValues {
  enabled: boolean
  sandbox: boolean
  appId: string
  privateKey: string
  publicKeyPem: string
  gateway: string
  mode: 'page' | 'wap' | 'qr'
  notifyUrl: string
  returnUrl: string
  displayName: string
  minTopUp: number
  timeoutExpress: string
}

const schema = z.object({
  enabled: z.boolean(),
  sandbox: z.boolean(),
  appId: z.string(),
  privateKey: z.string(),
  publicKeyPem: z.string(),
  gateway: z.string().refine((value) => {
    const trimmed = value.trim()
    if (!trimmed) return true
    return /^https?:\/\//.test(trimmed)
  }, 'Enter a gateway URL starting with http:// or https://'),
  mode: z.enum(['page', 'wap', 'qr']),
  notifyUrl: z.string(),
  returnUrl: z.string(),
  displayName: z.string(),
  minTopUp: z.coerce.number().min(1),
  timeoutExpress: z.string(),
})

type Values = z.infer<typeof schema>

export function AlipayOfficialSettingsSection({
  defaultValues,
}: {
  defaultValues: AlipayOfficialSettingsValues
}) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()

  const form = useForm<Values>({
    resolver: zodResolver(schema) as unknown as Resolver<Values>,
    defaultValues: {
      ...defaultValues,
      privateKey: '',
    },
  })

  const { isDirty, isSubmitting } = form.formState
  const enabled = form.watch('enabled')

  async function onSubmit(values: Values) {
    const updates: Array<{ key: string; value: string }> = []

    const push = (key: string, value: string, initial: string) => {
      if (value !== initial) {
        updates.push({ key: `alipay_setting.${key}`, value })
      }
    }

    push('enabled', String(values.enabled), String(defaultValues.enabled))
    push('sandbox', String(values.sandbox), String(defaultValues.sandbox))
    push('app_id', values.appId.trim(), defaultValues.appId)
    push(
      'public_key_pem',
      values.publicKeyPem.trim(),
      defaultValues.publicKeyPem
    )
    push('gateway', values.gateway.trim(), defaultValues.gateway)
    push('mode', values.mode, defaultValues.mode)
    push('notify_url', values.notifyUrl.trim(), defaultValues.notifyUrl)
    push('return_url', values.returnUrl.trim(), defaultValues.returnUrl)
    push('display_name', values.displayName.trim(), defaultValues.displayName)
    push('min_topup', String(values.minTopUp), String(defaultValues.minTopUp))
    push(
      'timeout_express',
      values.timeoutExpress.trim(),
      defaultValues.timeoutExpress
    )

    // 私钥不回显：留空表示保持原值
    const privateKey = values.privateKey.trim()
    if (privateKey) {
      updates.push({ key: 'alipay_setting.private_key', value: privateKey })
    }

    if (updates.length === 0) {
      toast.info(t('No changes to save'))
      return
    }

    for (const update of updates) {
      await updateOption.mutateAsync(update)
    }

    form.reset({ ...values, privateKey: '' })
  }

  return (
    <SettingsSection title={t('Alipay (Official Open Platform)')}>
      <Form {...form}>
        <SettingsForm onSubmit={form.handleSubmit(onSubmit)} autoComplete='off'>
          <SettingsPageFormActions
            onSave={form.handleSubmit(onSubmit)}
            isSaving={updateOption.isPending || isSubmitting}
            isSaveDisabled={!isDirty}
            saveLabel='Save Alipay settings'
          />

          <FormField
            control={form.control}
            name='enabled'
            render={({ field }) => (
              <SettingsSwitchItem>
                <SettingsSwitchContent>
                  <FormLabel>{t('Enable Alipay official gateway')}</FormLabel>
                  <FormDescription>
                    {t(
                      'Adds an Alipay entry to the wallet page and settles payments through the official open platform. Requires the compliance confirmation above.'
                    )}
                  </FormDescription>
                </SettingsSwitchContent>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={updateOption.isPending || isSubmitting}
                  />
                </FormControl>
              </SettingsSwitchItem>
            )}
          />

          {enabled && (
            <div className='grid gap-6'>
              <div className='grid gap-6 sm:grid-cols-2'>
                <FormField
                  control={form.control}
                  name='appId'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('App ID')}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder='2021xxxxxxxxxxxx'
                          autoComplete='off'
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        {t(
                          'The APPID of your application in the Alipay open platform console.'
                        )}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='displayName'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Display name')}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t('Alipay (Official)')}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        {t('Shown on the payment method button.')}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name='privateKey'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Application private key')}</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={4}
                        className='font-mono text-xs'
                        placeholder={t(
                          'Leave blank to keep the saved key. Paste the full key copied from the open platform.'
                        )}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      {t(
                        'RSA private key of your application (PKCS#8 or PKCS#1). Stored server-side and never returned to the browser.'
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='publicKeyPem'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Alipay public key')}</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={4}
                        className='font-mono text-xs'
                        placeholder={t(
                          'Paste the Alipay public key used to verify notifications.'
                        )}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      {t(
                        'Used to verify asynchronous notifications and gateway responses. PEM headers are optional.'
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className='grid gap-6 sm:grid-cols-2'>
                <FormField
                  control={form.control}
                  name='mode'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Payment product')}</FormLabel>
                      <FormControl>
                        <NativeSelect
                          value={field.value}
                          onChange={(event) =>
                            field.onChange(event.target.value)
                          }
                        >
                          <NativeSelectOption value='page'>
                            {t('Desktop website (page pay)')}
                          </NativeSelectOption>
                          <NativeSelectOption value='wap'>
                            {t('Mobile website (wap pay)')}
                          </NativeSelectOption>
                          <NativeSelectOption value='qr'>
                            {t('In-store QR (precreate)')}
                          </NativeSelectOption>
                        </NativeSelect>
                      </FormControl>
                      <FormDescription>
                        {t(
                          'Desktop redirects to the cashier page, in-store shows a QR code inside a dialog. Mobile visitors fall back to the wap cashier when page pay is selected.'
                        )}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='timeoutExpress'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Order timeout')}</FormLabel>
                      <FormControl>
                        <Input placeholder='30m' {...field} />
                      </FormControl>
                      <FormDescription>
                        {t(
                          'Alipay closes the trade after this period, for example 30m or 2h.'
                        )}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className='grid gap-6 sm:grid-cols-2'>
                <FormField
                  control={form.control}
                  name='notifyUrl'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Notification URL')}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder='/api/user/alipay/notify'
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        {t(
                          'Leave blank to use the server address plus /api/user/alipay/notify. Must be publicly reachable over HTTPS.'
                        )}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='returnUrl'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Return URL')}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder='/api/user/alipay/return'
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        {t(
                          'Leave blank to use the server address plus /api/user/alipay/return, which reconciles the order and redirects to the wallet.'
                        )}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className='grid gap-6 sm:grid-cols-2'>
                <FormField
                  control={form.control}
                  name='gateway'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Gateway URL')}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder='https://openapi.alipay.com/gateway.do'
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        {t(
                          'Leave blank to use the production gateway, or the sandbox gateway when sandbox mode is on.'
                        )}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='minTopUp'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Minimum top-up amount')}</FormLabel>
                      <FormControl>
                        <Input type='number' min={1} {...field} />
                      </FormControl>
                      <FormDescription>
                        {t(
                          'The larger of this value and the global minimum applies.'
                        )}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name='sandbox'
                render={({ field }) => (
                  <SettingsSwitchItem>
                    <SettingsSwitchContent>
                      <FormLabel>{t('Sandbox mode')}</FormLabel>
                      <FormDescription>
                        {t(
                          'Use the Alipay sandbox environment. Sandbox App ID and keys are different from the production ones.'
                        )}
                      </FormDescription>
                    </SettingsSwitchContent>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={updateOption.isPending || isSubmitting}
                      />
                    </FormControl>
                  </SettingsSwitchItem>
                )}
              />
            </div>
          )}
        </SettingsForm>
      </Form>
    </SettingsSection>
  )
}
