'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Trash2 } from 'lucide-react'
import { adminCancelRegistration } from '@/app/(frontend)/members/admin/events/actions'
import { Button } from '@/components/ui/button'

interface RegistrationActionsProps {
  registrationId: string
  memberName: string
  status: string
}

export function RegistrationActions({ registrationId, memberName, status }: RegistrationActionsProps) {
  const t = useTranslations('admin')
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [warning, setWarning] = useState('')

  // Once the row is cancelled only a lingering paid-invoice warning is worth showing.
  if (status === 'cancelled') {
    return warning ? <p className="text-xs text-amber-600">{warning}</p> : null
  }

  function handleRemove() {
    if (!confirm(t('confirmRemoveRegistration', { name: memberName }))) return
    setError('')
    setWarning('')
    startTransition(async () => {
      const result = await adminCancelRegistration(registrationId)
      if (result.success) {
        if (result.warning === 'registrationRemovedInvoicePaid') {
          setWarning(t('registrationRemovedInvoicePaid'))
        }
        router.refresh()
      } else {
        setError(
          result.error === 'registrationNotFound' || result.error === 'registrationAlreadyCancelled'
            ? t(result.error)
            : (result.error ?? t('error')),
        )
      }
    })
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        size="sm"
        variant="ghost"
        className="text-destructive hover:text-destructive"
        disabled={isPending}
        onClick={handleRemove}
        aria-label={t('removeRegistration')}
        title={t('removeRegistration')}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {warning && <p className="text-xs text-amber-600">{warning}</p>}
    </div>
  )
}
