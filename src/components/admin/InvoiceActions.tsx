'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { sendInvoice, markInvoicePaid, cancelInvoice } from '@/app/(frontend)/members/admin/invoices/actions'
import { Button } from '@/components/ui/button'

interface InvoiceActionsProps {
  invoiceId: string
  status: string
}

export function InvoiceActions({ invoiceId, status }: InvoiceActionsProps) {
  const t = useTranslations('admin')
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  function run(action: () => Promise<{ success: boolean; error?: string }>) {
    setError('')
    startTransition(async () => {
      const result = await action()
      if (!result.success) {
        const known = ['invoiceNotFound', 'invoicePaidNotCancellable']
        setError(result.error && known.includes(result.error) ? t(result.error) : (result.error ?? t('error')))
        return
      }
      router.refresh()
    })
  }

  function handleCancel() {
    // A sent invoice is already in the member's hands; confirm before voiding it.
    if (status === 'sent' && !confirm(t('confirmCancelSentInvoice'))) return
    run(() => cancelInvoice(invoiceId))
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex gap-2">
        {status === 'draft' && (
          <Button variant="outline" size="sm" onClick={() => run(() => sendInvoice(invoiceId))} disabled={isPending}>
            {isPending ? t('sending') : t('sendInvoice')}
          </Button>
        )}
        {status === 'sent' && (
          <Button variant="outline" size="sm" onClick={() => run(() => markInvoicePaid(invoiceId))} disabled={isPending}>
            {t('markPaid')}
          </Button>
        )}
        {(status === 'draft' || status === 'sent') && (
          <Button variant="destructive" size="sm" onClick={handleCancel} disabled={isPending}>
            {t('cancelInvoice')}
          </Button>
        )}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
