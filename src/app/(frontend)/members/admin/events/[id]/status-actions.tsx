'use client'

import { useTransition, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { updateEventStatus, deleteEvent } from '@/app/(frontend)/members/admin/events/actions'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'

interface EventStatusActionsProps {
  eventId: string
  currentStatus: string
}

export function EventStatusActions({ eventId, currentStatus }: EventStatusActionsProps) {
  const t = useTranslations('admin')
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  function handleStatus(status: 'draft' | 'published' | 'cancelled' | 'completed') {
    setError('')
    setMessage('')
    startTransition(async () => {
      const result = await updateEventStatus(eventId, status)
      if (result.success) {
        const msgs: Record<string, string> = {
          published: t('eventPublished'),
          draft: t('eventUnpublished'),
          completed: t('eventCompleted'),
          cancelled: t('eventCancelled'),
        }
        setMessage(msgs[status] ?? t('updated'))
        router.refresh()
      } else {
        setError(result.error ?? t('error'))
      }
    })
  }

  function handleDelete() {
    setError('')
    setMessage('')
    startTransition(async () => {
      const result = await deleteEvent(eventId)
      if (result.success) {
        router.push('/members/admin/events')
      } else {
        setError(
          result.error === 'eventHasRegistrations'
            ? t('eventHasRegistrations')
            : (result.error ?? t('error')),
        )
      }
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {currentStatus === 'draft' && (
          <Button size="sm" disabled={isPending} onClick={() => handleStatus('published')}>
            {t('publish')}
          </Button>
        )}
        {currentStatus === 'published' && (
          <>
            <Button size="sm" variant="outline" disabled={isPending} onClick={() => handleStatus('draft')}>
              {t('unpublish')}
            </Button>
            <Button size="sm" disabled={isPending} onClick={() => handleStatus('completed')}>
              {t('complete')}
            </Button>
          </>
        )}
        {(currentStatus === 'draft' || currentStatus === 'published') && (
          <Button size="sm" variant="destructive" disabled={isPending} onClick={() => handleStatus('cancelled')}>
            {t('cancelEvent')}
          </Button>
        )}
        {currentStatus === 'draft' && (
          <Button size="sm" variant="destructive" disabled={isPending} onClick={handleDelete}>
            {t('delete')}
          </Button>
        )}
      </div>
      {error && <Alert variant="destructive">{error}</Alert>}
      {message && <Alert variant="success">{message}</Alert>}
    </div>
  )
}
