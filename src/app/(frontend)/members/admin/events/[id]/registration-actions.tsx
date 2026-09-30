'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Trash2 } from 'lucide-react'
import { adminCancelRegistration } from '@/app/(frontend)/members/admin/events/actions'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface RegistrationActionsProps {
  registrationId: string
  memberName: string
  status: string
  /** Past the cancellation deadline the signup is binding; ask whether the fee still applies. */
  pastCancellationDeadline: boolean
}

export function RegistrationActions({
  registrationId,
  memberName,
  status,
  pastCancellationDeadline,
}: RegistrationActionsProps) {
  const t = useTranslations('admin')
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [warning, setWarning] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)

  // Once the row is cancelled only a lingering paid-invoice warning is worth showing.
  if (status === 'cancelled') {
    return warning ? <p className="text-xs text-amber-600">{warning}</p> : null
  }

  function handleRemoveClick() {
    if (pastCancellationDeadline) {
      setDialogOpen(true)
      return
    }
    if (!confirm(t('confirmRemoveRegistration', { name: memberName }))) return
    remove(false)
  }

  function remove(keepFee: boolean) {
    setDialogOpen(false)
    setError('')
    setWarning('')
    startTransition(async () => {
      const result = await adminCancelRegistration(registrationId, { keepFee })
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
        onClick={handleRemoveClick}
        aria-label={t('removeRegistration')}
        title={t('removeRegistration')}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('removeRegistration')}: {memberName}</DialogTitle>
            <DialogDescription>{t('lateRemovalExplanation')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => remove(false)} disabled={isPending}>
              {t('lateRemovalWaiveFee')}
            </Button>
            <Button onClick={() => remove(true)} disabled={isPending} autoFocus>
              {t('lateRemovalKeepFee')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {warning && <p className="text-xs text-amber-600">{warning}</p>}
    </div>
  )
}
