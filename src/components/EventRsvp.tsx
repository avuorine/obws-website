'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'

interface EventRsvpProps {
  eventId: string
  userStatus: string | null
  isLottery: boolean
  lotteryCompleted: boolean
  isFull: boolean
  isDeadlinePassed: boolean
  isRegistrationNotOpenYet: boolean
  registrationOpensAt: string | null
  canCancel: boolean
  isAdmin: boolean
  guestAllowed: boolean
  guestCount: number
  maxGuestsPerMember: number
  isGuestRegistrationOpen: boolean
  guestRegistrationOpensAt: string | null
  registerAction: (eventId: string) => Promise<{ success: boolean; error?: string }>
  cancelAction: (eventId: string) => Promise<{ success: boolean; error?: string }>
  lotteryAction: (eventId: string) => Promise<{ success: boolean; error?: string }>
  addGuestAction: (eventId: string) => Promise<{ success: boolean; error?: string }>
  removeGuestAction: (eventId: string) => Promise<{ success: boolean; error?: string }>
}

function useCountdown(targetIso: string | null) {
  const [remaining, setRemaining] = useState<number | null>(null)
  const router = useRouter()

  useEffect(() => {
    if (!targetIso) return
    const target = new Date(targetIso).getTime()

    function tick() {
      const diff = target - Date.now()
      if (diff <= 0) {
        setRemaining(0)
        router.refresh()
        return
      }
      setRemaining(diff)
    }

    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [targetIso, router])

  return remaining
}

function formatCountdown(ms: number, t: (key: string) => string) {
  const totalSeconds = Math.ceil(ms / 1000)
  const d = Math.floor(totalSeconds / 86400)
  const h = Math.floor((totalSeconds % 86400) / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60

  if (d > 0) {
    return `${d}${t('days')} ${h}${t('hours')} ${m}${t('minutes')} ${s}${t('seconds')}`
  }
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function EventRsvp({
  eventId,
  userStatus,
  isLottery,
  lotteryCompleted,
  isFull,
  isDeadlinePassed,
  isRegistrationNotOpenYet,
  registrationOpensAt,
  canCancel,
  isAdmin,
  guestAllowed,
  guestCount,
  maxGuestsPerMember,
  isGuestRegistrationOpen,
  guestRegistrationOpensAt,
  registerAction,
  cancelAction,
  lotteryAction,
  addGuestAction,
  removeGuestAction,
}: EventRsvpProps) {
  const t = useTranslations('events')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const countdown = useCountdown(isRegistrationNotOpenYet ? registrationOpensAt : null)
  const guestCountdown = useCountdown(
    guestAllowed && !isGuestRegistrationOpen ? guestRegistrationOpensAt : null,
  )

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

  function handleAddGuest() {
    setError('')
    startTransition(async () => {
      const result = await addGuestAction(eventId)
      if (!result.success) setError(result.error ?? 'Something went wrong')
    })
  }

  function handleRemoveGuest() {
    setError('')
    startTransition(async () => {
      const result = await removeGuestAction(eventId)
      if (!result.success) setError(result.error ?? 'Something went wrong')
    })
  }

  const canRegister =
    !isRegistrationNotOpenYet &&
    !isDeadlinePassed &&
    !userStatus &&
    (!isFull || isLottery)

  const showCancel =
    canCancel &&
    (userStatus === 'registered' || userStatus === 'waitlisted' || userStatus === 'pending')

  const hasActiveRegistration =
    userStatus === 'registered' || userStatus === 'waitlisted'

  const showGuestSection = guestAllowed && hasActiveRegistration

  const canAddGuest =
    isGuestRegistrationOpen &&
    guestCount < maxGuestsPerMember &&
    !isDeadlinePassed &&
    !(isLottery && !lotteryCompleted) &&
    !(userStatus === 'registered' && isFull)

  return (
    <div className="space-y-3">
      {userStatus === 'registered' && (
        <p className="font-medium text-green-700">{t('registered')}</p>
      )}
      {userStatus === 'waitlisted' && (
        <p className="font-medium text-yellow-700">{t('waitlisted')}</p>
      )}
      {isLottery && !lotteryCompleted && (
        <p className="text-sm text-muted-foreground">{t('lotteryPending')}</p>
      )}
      {isLottery && lotteryCompleted && (
        <p className="text-sm text-muted-foreground">{t('lotteryCompleted')}</p>
      )}
      {isRegistrationNotOpenYet && !userStatus && countdown !== null && countdown > 0 && (
        <p className="text-sm font-medium text-muted-foreground">
          {t('registrationOpensIn')} {formatCountdown(countdown, t)}
        </p>
      )}
      {isDeadlinePassed && !userStatus && (
        <p className="text-sm text-muted-foreground">{t('registrationClosed')}</p>
      )}

      <div className="flex gap-3">
        {canRegister && (
          <Button onClick={handleRegister} disabled={isPending}>
            {isPending ? t('registering') : t('register')}
          </Button>
        )}

        {showCancel && (
          <Button variant="destructive" onClick={handleCancel} disabled={isPending}>
            {isPending ? t('cancelling') : t('cancel')}
          </Button>
        )}

        {isAdmin && isLottery && !lotteryCompleted && (
          <Button variant="outline" onClick={handleLottery} disabled={isPending}>
            {isPending ? t('runningLottery') : t('runLottery')}
          </Button>
        )}
      </div>

      {showGuestSection && (
        <div className="mt-4 space-y-2 border-t pt-4">
          <p className="text-sm font-medium">
            {t('guests')}: {guestCount} / {maxGuestsPerMember}
          </p>
          {isLottery && !lotteryCompleted && (
            <p className="text-sm text-muted-foreground">{t('guestsAfterLottery')}</p>
          )}
          {!isGuestRegistrationOpen && guestCountdown !== null && guestCountdown > 0 && (
            <p className="text-sm text-muted-foreground">
              {t('guestRegistrationOpensIn')} {formatCountdown(guestCountdown, t)}
            </p>
          )}
          {isGuestRegistrationOpen && userStatus === 'registered' && isFull && guestCount >= maxGuestsPerMember && (
            <p className="text-sm text-muted-foreground">{t('eventFullNoGuests')}</p>
          )}
          {isGuestRegistrationOpen && guestCount >= maxGuestsPerMember && !(userStatus === 'registered' && isFull) && (
            <p className="text-sm text-muted-foreground">{t('guestLimitReached')}</p>
          )}
          <div className="flex gap-3">
            {canAddGuest && (
              <Button variant="outline" size="sm" onClick={handleAddGuest} disabled={isPending}>
                {t('addGuest')}
              </Button>
            )}
            {guestCount > 0 && (
              <Button variant="outline" size="sm" onClick={handleRemoveGuest} disabled={isPending}>
                {t('removeGuest')}
              </Button>
            )}
          </div>
        </div>
      )}

      {error && <Alert variant="destructive">{error}</Alert>}
    </div>
  )
}
