'use client'

import { useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { bulkSendInvoices } from './actions'
import { Button } from '@/components/ui/button'

interface BulkSendButtonProps {
  invoiceIds: string[]
}

export function BulkSendButton({ invoiceIds }: BulkSendButtonProps) {
  const t = useTranslations('admin')
  const [isPending, startTransition] = useTransition()

  function handleSendAll() {
    startTransition(async () => {
      await bulkSendInvoices(invoiceIds)
    })
  }

  return (
    <Button variant="outline" onClick={handleSendAll} disabled={isPending}>
      {isPending ? t('sending') : t('sendAll')}
    </Button>
  )
}
