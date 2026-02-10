'use client'

import { useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { sendInvoice, markInvoicePaid, cancelInvoice } from '@/app/(frontend)/members/admin/invoices/actions'
import { Button } from '@/components/ui/button'

interface InvoiceActionsProps {
  invoiceId: string
  status: string
}

export function InvoiceActions({ invoiceId, status }: InvoiceActionsProps) {
  const t = useTranslations('admin')
  const [isPending, startTransition] = useTransition()

  function handleSend() {
    startTransition(async () => {
      await sendInvoice(invoiceId)
    })
  }

  function handleMarkPaid() {
    startTransition(async () => {
      await markInvoicePaid(invoiceId)
    })
  }

  function handleCancel() {
    startTransition(async () => {
      await cancelInvoice(invoiceId)
    })
  }

  return (
    <div className="flex gap-2">
      {status === 'draft' && (
        <>
          <Button variant="outline" size="sm" onClick={handleSend} disabled={isPending}>
            {isPending ? t('sending') : t('sendInvoice')}
          </Button>
          <Button variant="destructive" size="sm" onClick={handleCancel} disabled={isPending}>
            {t('cancelAction')}
          </Button>
        </>
      )}
      {status === 'sent' && (
        <Button variant="outline" size="sm" onClick={handleMarkPaid} disabled={isPending}>
          {t('markPaid')}
        </Button>
      )}
    </div>
  )
}
