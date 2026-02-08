'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'

interface EventRsvpProps {
  eventId: string
  userStatus: string | null
  isLottery: boolean
  lotteryCompleted: boolean
  isFull: boolean
  isDeadlinePassed: boolean
  isAdmin: boolean
  registerAction: (eventId: string) => Promise<{ success: boolean; error?: string }>
  cancelAction: (eventId: string) => Promise<{ success: boolean; error?: string }>
  lotteryAction: (eventId: string) => Promise<{ success: boolean; error?: string }>
}

export function EventRsvp({
  eventId,
  userStatus,
  isLottery,
  lotteryCompleted,
  isFull,
  isDeadlinePassed,
  isAdmin,
  registerAction,
  cancelAction,
  lotteryAction,
}: EventRsvpProps) {
  const t = useTranslations('events')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  function handleRegister() {
    setError('')
    startTransition(async () => {
      const result = await registerAction(eventId)
      if (!result.success) setError(result.error ?? 'Something went wrong')
    })
  }

  function handleCancel() {
    setError('')
    startTransition(async () => {
      const result = await cancelAction(eventId)
      if (!result.success) setError(result.error ?? 'Something went wrong')
    })
  }

  function handleLottery() {
    setError('')
    startTransition(async () => {
      const result = await lotteryAction(eventId)
      if (!result.success) setError(result.error ?? 'Something went wrong')
    })
  }

  const canRegister =
    !isDeadlinePassed &&
    !userStatus &&
    (!isFull || isLottery)

  const canCancel =
    !isDeadlinePassed &&
    (userStatus === 'registered' || userStatus === 'waitlisted' || userStatus === 'pending')

  return (
    <div className="space-y-3">
      {userStatus === 'registered' && (
        <p className="font-medium text-green-700">{t('registered')}</p>
      )}
      {userStatus === 'waitlisted' && (
        <p className="font-medium text-yellow-700">{t('waitlisted')}</p>
      )}
      {isLottery && !lotteryCompleted && (
        <p className="text-sm text-whisky-light">{t('lotteryPending')}</p>
      )}
      {isLottery && lotteryCompleted && (
        <p className="text-sm text-whisky-light">{t('lotteryCompleted')}</p>
      )}
      {isDeadlinePassed && !userStatus && (
        <p className="text-sm text-whisky-light">{t('registrationClosed')}</p>
      )}

      <div className="flex gap-3">
        {canRegister && (
          <button
            onClick={handleRegister}
            disabled={isPending}
            className="rounded-lg bg-amber px-6 py-2 font-medium text-white transition-colors hover:bg-amber/90 disabled:opacity-50"
          >
            {isPending ? t('registering') : t('register')}
          </button>
        )}

        {canCancel && (
          <button
            onClick={handleCancel}
            disabled={isPending}
            className="rounded-lg border border-red-300 px-6 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
          >
            {isPending ? t('cancelling') : t('cancel')}
          </button>
        )}

        {isAdmin && isLottery && !lotteryCompleted && (
          <button
            onClick={handleLottery}
            disabled={isPending}
            className="rounded-lg border border-amber px-6 py-2 text-sm font-medium text-amber transition-colors hover:bg-amber/10 disabled:opacity-50"
          >
            {isPending ? t('runningLottery') : t('runLottery')}
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
