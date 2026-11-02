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
import { CheckCircle2, RefreshCw } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

import type { AlipayQrPayload } from '../../hooks'

interface AlipayQrDialogProps {
  payload: AlipayQrPayload | null
  onClose: () => void
  onConfirmPaid: () => void
  checking?: boolean
}

/**
 * 支付宝当面付扫码弹窗。
 *
 * 二维码内容由后端 alipay.trade.precreate 返回，扫码支付成功后支付宝会异步通知入账；
 * 这里只负责展示与「我已支付」手动刷新余额，不做前端轮询，避免打断用户流程。
 */
export function AlipayQrDialog({
  payload,
  onClose,
  onConfirmPaid,
  checking = false,
}: AlipayQrDialogProps) {
  const { t } = useTranslation()
  const open = Boolean(payload)

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (!next ? onClose() : undefined)}
    >
      <DialogContent className='max-sm:w-[calc(100vw-1.5rem)] sm:max-w-[400px]'>
        <DialogHeader>
          <DialogTitle className='text-xl font-semibold'>
            {t('Scan with Alipay to pay')}
          </DialogTitle>
          <DialogDescription>
            {t('Open Alipay on your phone and scan the code below')}
          </DialogDescription>
        </DialogHeader>

        <div className='flex flex-col items-center gap-4 py-2'>
          <div className='rounded-2xl border bg-white p-4'>
            {payload ? (
              <QRCodeSVG value={payload.qrCode} size={208} level='M' />
            ) : null}
          </div>
          {payload?.money ? (
            <div className='text-center'>
              <div className='text-muted-foreground text-xs'>
                {t('Amount to pay:')}
              </div>
              <div className='mt-1 text-2xl font-semibold tabular-nums'>
                ¥{payload.money}
              </div>
            </div>
          ) : null}
          {payload?.tradeNo ? (
            <div className='text-muted-foreground max-w-full truncate text-xs'>
              {t('Order number')}: {payload.tradeNo}
            </div>
          ) : null}
          <p className='text-muted-foreground text-center text-xs leading-5'>
            {t(
              'Keep this dialog open until Alipay confirms the payment; the balance updates automatically once the payment succeeds.'
            )}
          </p>
        </div>

        <DialogFooter className='gap-2 sm:justify-between'>
          <Button variant='outline' onClick={onClose}>
            {t('Cancel')}
          </Button>
          <Button onClick={onConfirmPaid} disabled={checking}>
            {checking ? (
              <RefreshCw className='h-4 w-4 animate-spin' />
            ) : (
              <CheckCircle2 className='h-4 w-4' />
            )}
            {t('I have paid')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
