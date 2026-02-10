'use client'

import { useTransition, useState } from 'react'
import { useTranslations } from 'next-intl'
import { createEventInvoices } from '@/app/(frontend)/members/admin/invoices/actions'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'

interface EventInvoiceButtonProps {
  eventId: string
}

export function EventInvoiceButton({ eventId }: EventInvoiceButtonProps) {
  const t = useTranslations('admin')
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  function handleGenerate() {
    setMessage(null)
    startTransition(async () => {
      const result = await createEventInvoices(eventId)
      if (result.success) {
        setMessage({ type: 'success', text: t('updated') })
      } else {
        setMessage({ type: 'error', text: result.error ?? t('error') })
      }
    })
  }

  return (
    <div className="space-y-3">
      <Button variant="outline" onClick={handleGenerate} disabled={isPending}>
        {isPending ? t('generating') : t('generateEventInvoices')}
      </Button>
      {message && (
        <Alert variant={message.type === 'success' ? 'success' : 'destructive'}>
          {message.text}
        </Alert>
      )}
    </div>
  )
}
