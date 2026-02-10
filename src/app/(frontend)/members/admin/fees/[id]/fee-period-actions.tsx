'use client'

import { useTransition, useState } from 'react'
import { useTranslations } from 'next-intl'
import { generateFeesForPeriod } from '@/app/(frontend)/members/admin/fees/actions'
import { bulkCreateMembershipInvoices } from '@/app/(frontend)/members/admin/invoices/actions'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'

interface FeePeriodActionsProps {
  feePeriodId: string
}

export function FeePeriodActions({ feePeriodId }: FeePeriodActionsProps) {
  const t = useTranslations('admin')
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  function handleGenerateFees() {
    setMessage(null)
    startTransition(async () => {
      const result = await generateFeesForPeriod(feePeriodId)
      if (result.success) {
        setMessage({ type: 'success', text: t('feesGenerated', { count: result.count ?? 0 }) })
      } else {
        setMessage({ type: 'error', text: result.error ?? t('error') })
      }
    })
  }

  function handleGenerateInvoices() {
    setMessage(null)
    startTransition(async () => {
      const result = await bulkCreateMembershipInvoices(feePeriodId)
      if (result.success) {
        setMessage({ type: 'success', text: t('updated') })
      } else {
        setMessage({ type: 'error', text: result.error ?? t('error') })
      }
    })
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-wrap gap-3">
        <Button variant="outline" onClick={handleGenerateFees} disabled={isPending}>
          {isPending ? t('generating') : t('generateFees')}
        </Button>
        <Button variant="outline" onClick={handleGenerateInvoices} disabled={isPending}>
          {isPending ? t('generating') : t('generateInvoices')}
        </Button>
      </div>

      {message && (
        <Alert variant={message.type === 'success' ? 'success' : 'destructive'}>
          {message.text}
        </Alert>
      )}
    </div>
  )
}
