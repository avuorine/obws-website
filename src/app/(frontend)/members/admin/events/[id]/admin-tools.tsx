'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Shuffle, Receipt } from 'lucide-react'
import { runLottery } from '@/app/(frontend)/members/admin/events/actions'
import { createEventInvoices } from '@/app/(frontend)/members/admin/invoices/actions'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'

interface EventAdminToolsProps {
  eventId: string
  isLottery: boolean
  lotteryCompleted: boolean
  pendingCount: number
  registeredCount: number
  waitlistedCount: number
  hasPrice: boolean
  fullyInvoiced: number
  needsInvoice: number
  overbilled: number
}

type Message = { type: 'success' | 'error'; text: string }

export function EventAdminTools({
  eventId,
  isLottery,
  lotteryCompleted,
  pendingCount,
  registeredCount,
  waitlistedCount,
  hasPrice,
  fullyInvoiced,
  needsInvoice,
  overbilled,
}: EventAdminToolsProps) {
  const t = useTranslations('admin')
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [lotteryMessage, setLotteryMessage] = useState<Message | null>(null)
  const [invoiceMessage, setInvoiceMessage] = useState<Message | null>(null)

  if (!isLottery && !hasPrice) return null

  function handleLottery() {
    if (!confirm(t('confirmRunLottery'))) return
    setLotteryMessage(null)
    startTransition(async () => {
      const result = await runLottery(eventId)
      if (result.success) {
        setLotteryMessage({ type: 'success', text: t('lotteryRun') })
        router.refresh()
      } else {
        setLotteryMessage({ type: 'error', text: result.error ?? t('error') })
      }
    })
  }

  function handleInvoices() {
    setInvoiceMessage(null)
    startTransition(async () => {
      const result = await createEventInvoices(eventId)
      if (result.success) {
        setInvoiceMessage({
          type: 'success',
          text: t('eventInvoicesResult', { created: result.created ?? 0, updated: result.updated ?? 0 }),
        })
        router.refresh()
      } else {
        setInvoiceMessage({ type: 'error', text: result.error ?? t('error') })
      }
    })
  }

  return (
    <>
      {isLottery && (
        <section className="space-y-3 border-t border-input pt-6">
          <h3 className="flex items-center gap-2 text-sm font-medium">
            <Shuffle className="h-4 w-4" />
            {t('lottery')}
          </h3>
          {lotteryCompleted ? (
            <p className="text-sm text-muted-foreground">
              {t('lotteryDone', { registered: registeredCount, waitlisted: waitlistedCount })}
            </p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                {t('lotteryPendingCount', { count: pendingCount })}
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={handleLottery}
                disabled={isPending || pendingCount === 0}
              >
                {isPending ? t('runningLottery') : t('runLottery')}
              </Button>
            </>
          )}
          {lotteryMessage && (
            <Alert variant={lotteryMessage.type === 'success' ? 'success' : 'destructive'}>
              {lotteryMessage.text}
            </Alert>
          )}
        </section>
      )}

      {hasPrice && (
        <section className="space-y-3 border-t border-input pt-6">
          <h3 className="flex items-center gap-2 text-sm font-medium">
            <Receipt className="h-4 w-4" />
            {t('invoicing')}
          </h3>
          <p className="text-sm text-muted-foreground">
            {t('billingSummary', { registered: registeredCount, invoiced: fullyInvoiced, needs: needsInvoice })}
          </p>
          {overbilled > 0 && (
            <p className="text-sm text-amber-600">{t('overbilledHint', { count: overbilled })}</p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleInvoices}
              disabled={isPending || needsInvoice === 0}
            >
              {isPending ? t('generating') : t('generateEventInvoices')}
            </Button>
            <Button size="sm" variant="ghost" asChild>
              <Link href="/members/admin/invoices">{t('invoices')}</Link>
            </Button>
          </div>
          {invoiceMessage && (
            <Alert variant={invoiceMessage.type === 'success' ? 'success' : 'destructive'}>
              {invoiceMessage.text}
            </Alert>
          )}
        </section>
      )}
    </>
  )
}
