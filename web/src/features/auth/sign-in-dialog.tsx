/*
 * 弹窗式登录（不跳页）
 * ------------------------------------------------------------------
 * 点「登录/注册」在当前页弹模态框，登录成功只刷新登录态（applyAuthBundle）+ 关闭弹窗，
 * 不跳页、不 reload，已填的提示词/已选风格都不丢。
 *
 * 布局（对齐参考图，按 DESIGN-SYSTEM-YMM 的「大气 / 无框分层 / 零外网资源」执行）：
 * - 顶部品牌横幅：纯 CSS 渐变 + 光斑，不用任何外链图片
 * - 左栏：账号登录（复用 UserAuthForm：密码 / 第三方 / Passkey / 条款）
 * - 右栏：微信扫码登录（背景浅一档做无框分层，不画分割线）
 *
 * 未接入的能力（等后台接口，先不渲染假控件）：手机号验证码登录、邮箱验证码登录、QQ 扫码。
 */
import { QrCode, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { wechatLoginByCode } from '@/features/auth/api'
import { useAuthRedirect } from '@/features/auth/hooks/use-auth-redirect'
import { UserAuthForm } from '@/features/auth/sign-in/components/user-auth-form'
import { TermsFooter } from '@/features/auth/components/terms-footer'
import { useStatus } from '@/hooks/use-status'
import { handleServerError } from '@/lib/handle-server-error'
import { AuthOperationError } from '@/lib/secure-verification'

const listeners = new Set<(open: boolean) => void>()
let isOpen = false

function emit(open: boolean) {
  isOpen = open
  listeners.forEach((listener) => listener(open))
}

/** 打开登录弹窗（任意位置可调用） */
export function openSignInDialog() {
  emit(true)
}

/** 关闭登录弹窗 */
export function closeSignInDialog() {
  emit(false)
}

/** 后台配置的公众号二维码（不同版本字段名不一，逐个兜） */
function resolveWechatQr(status: Record<string, unknown> | null | undefined) {
  if (!status) return ''
  const s = status as Record<string, string | undefined>
  const data = (status.data ?? {}) as Record<string, string | undefined>
  return (
    s.wechat_qrcode ||
    s.wechat_qr_code ||
    s.wechat_qrcode_image_url ||
    s.wechat_qr_code_image_url ||
    s.wechat_account_qrcode_image_url ||
    s.WeChatAccountQRCodeImageURL ||
    data.wechat_qrcode ||
    data.WeChatAccountQRCodeImageURL ||
    ''
  )
}

export function SignInDialog() {
  const { t } = useTranslation()
  const { status } = useStatus()
  const [open, setOpen] = useState(isOpen)

  useEffect(() => {
    listeners.add(setOpen)
    setOpen(isOpen)
    return () => {
      listeners.delete(setOpen)
    }
  }, [])

  const wechatEnabled = Boolean(status?.wechat_login)
  const wechatQr = useMemo(() => resolveWechatQr(status), [status])
  const showRegister =
    !status?.self_use_mode_enabled && status?.register_enabled !== false

  return (
    <Dialog open={open} onOpenChange={emit}>
      <DialogContent
        className='bg-card w-[min(780px,94vw)] max-w-[calc(100vw-32px)] gap-0 overflow-hidden rounded-[22px] border-0 p-0 shadow-[0_24px_70px_-24px_rgba(0,0,0,0.35)] sm:max-w-[min(780px,94vw)]'
        showCloseButton={false}
      >
        <DialogTitle className='sr-only'>{t('Sign in')}</DialogTitle>

        {/* ── 顶部横幅：纯 CSS 渐变，零外链 ───────────────────────── */}
        <div
          className='relative isolate overflow-hidden px-9 py-10'
          style={{
            backgroundImage:
              'linear-gradient(112deg, color-mix(in oklch, var(--primary) 88%, black) 0%, var(--primary) 48%, color-mix(in oklch, var(--primary) 68%, white) 100%)',
          }}
        >
          <span className='pointer-events-none absolute -top-16 -left-10 size-56 rounded-full bg-white/15 blur-3xl' />
          <span className='pointer-events-none absolute -right-6 -bottom-20 size-64 rounded-full bg-white/12 blur-3xl' />
          <span className='pointer-events-none absolute top-6 right-1/3 size-24 rounded-full bg-white/10 blur-2xl' />

          <div className='relative flex flex-wrap items-end gap-x-10 gap-y-4'>
            <div className='space-y-2'>
              <p className='text-[12px] font-medium tracking-[0.22em] text-white/70'>
                YMM · 一幕AI
              </p>
              <h2 className='text-[27px] leading-[1.25] font-semibold tracking-tight text-white'>
                登录即送，AI 创作大礼包
              </h2>
              <p className='text-[13px] leading-[1.7] text-white/85'>
                对新用户与会员用户限时免费，登录后即可保存作品、同步额度
              </p>
            </div>

            <span className='mb-1 rounded-[10px] border border-dashed border-white/45 px-3 py-1.5 text-[12px] text-white/85'>
              限时 · 每日赠送创作额度
            </span>
          </div>

          <button
            type='button'
            onClick={() => emit(false)}
            aria-label={t('Close')}
            className='absolute top-4 right-4 flex size-8 items-center justify-center rounded-[10px] text-white/75 transition-colors hover:bg-white/15 hover:text-white'
          >
            <X className='size-4.5' />
          </button>
        </div>

        {/* ── 主体：左账号 / 右微信 ───────────────────────────────── */}
        <div className="grid max-h-[min(600px,calc(100dvh-280px))] overflow-y-auto lg:grid-cols-[minmax(0,1fr)_280px] [&_input]:h-11 [&_input]:text-[15px] [&_label]:text-[13px] [&_button[type=submit]]:h-11 [&_button[type=submit]]:text-[15px]">
          <div className='px-9 py-10'>
            <h3 className='text-foreground text-[16px] font-semibold'>账号登录</h3>
            <p className='text-muted-foreground mt-1.5 text-[12px] leading-[1.7]'>
              使用用户名或邮箱登录，也支持第三方账号与通行密钥
            </p>

            <div className='mt-6'>
              <UserAuthForm stayOnPage hideWeChatEntry onSuccess={() => emit(false)} />
            </div>

            {showRegister && (
              <p className='text-muted-foreground mt-6 text-[13px]'>
                还没有账号？{' '}
                <button
                  type='button'
                  onClick={() => emit(false)}
                  className='text-primary font-medium underline-offset-4 hover:underline'
                >
                  {t('Sign up')}
                </button>
              </p>
            )}

            <TermsFooter
              variant='sign-in'
              status={status}
              className='mt-6 text-left'
            />
          </div>

          {/* 右栏：无框分层，浅一档底色区分，不画分割线 */}
          <aside className='bg-muted px-8 py-10'>
            <h3 className='text-foreground text-[16px] font-semibold'>
              微信扫码登录
            </h3>
            <p className='text-muted-foreground mt-1.5 text-[12px] leading-[1.7]'>
              扫码关注公众号，回复「验证码」获取登录码
            </p>

            <div className='mt-5 flex justify-center'>
              {wechatQr ? (
                <div className='rounded-[14px] bg-white p-2.5 shadow-sm'>
                  <img
                    src={wechatQr}
                    alt='微信登录二维码'
                    className='size-[172px] rounded-[8px] object-contain'
                  />
                </div>
              ) : (
                <div className='border-border flex size-[204px] flex-col items-center justify-center gap-2.5 rounded-[16px] border border-dashed text-center'>
                  <QrCode className='text-muted-foreground/45 size-8' strokeWidth={1.5} />
                  <span className='text-muted-foreground/80 text-[12px] leading-[1.7]'>
                    二维码待后台配置
                    <br />
                    （系统设置 → 微信登录）
                  </span>
                </div>
              )}
            </div>

            {wechatEnabled ? (
              <WeChatCodeForm onDone={() => emit(false)} />
            ) : (
              <p className='text-muted-foreground mt-5 text-center text-[12px]'>
                微信登录暂未开通，可先用左侧账号密码登录
              </p>
            )}
          </aside>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** 微信登录：输入公众号回复的验证码兑换登录态 */
function WeChatCodeForm({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation()
  const { handleLoginResult } = useAuthRedirect()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    const value = code.trim()
    if (!value || busy) return
    setBusy(true)
    try {
      const res = await wechatLoginByCode(value)
      if (res?.success) {
        if (await handleLoginResult(res.data, undefined, true)) {
          toast.success(t('Signed in via WeChat'))
          onDone()
        }
      } else {
        toast.error(res?.message || '验证码无效或已过期')
      }
    } catch (error) {
      handleServerError(AuthOperationError.from(error, '微信登录失败'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className='mt-5 space-y-2.5'>
      <Input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            void submit()
          }
        }}
        placeholder='输入验证码'
        autoComplete='one-time-code'
        className='h-10'
      />
      <Button
        type='button'
        variant='secondary'
        className='h-10 w-full'
        disabled={busy || !code.trim()}
        onClick={() => void submit()}
      >
        {busy ? '登录中…' : '使用验证码登录'}
      </Button>
    </div>
  )
}
