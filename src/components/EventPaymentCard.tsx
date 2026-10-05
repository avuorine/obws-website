'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Check, Copy, FileDown } from 'lucide-react'
import { Button } from '@/components/ui/button'

/** Set by EventRsvp right after a signup, so the card scrolls into view once it appears. */
export const SCROLL_TO_PAYMENT_KEY = 'obws:scrollToPayment'

interface EventPaymentCardProps {
  invoiceId: string
  invoiceNumber: number
  /** Still to pay, two decimals. */
  amount: string
  /** Formatted due date, or "today". */
  dueLabel: string
  seatReleaseLabel: string | null
  overdue: boolean
  recipient: string
  iban: string | null
  bic: string | null
  /** Formatted for reading, e.g. "12 34561". */
  reference: string
  /** Finnish virtual barcode for pasting into a banking app. */
  barcode: string | null
}

function CopyRow({ label, value, display }: { label: string; value: string; display?: string }) {
  const t = useTranslations('events')
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard blocked: the value is still selectable.
    }
  }

  return (
    <div className="flex items-center justify-between gap-2 border-b border-input py-2 last:border-b-0">
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="break-all font-mono select-all">{display ?? value}</p>
      </div>
      <Button type="button" variant="ghost" size="sm" onClick={copy} aria-label={`${t('copy')}: ${label}`}>
        {copied ? <Check className="h-4 w-4 text-green-700" /> : <Copy className="h-4 w-4" />}
        <span className="ml-1 text-xs">{copied ? t('copied') : t('copy')}</span>
      </Button>
    </div>
  )
}

/**
 * Everything needed to pay a binding signup's invoice straight from the
 * event page: amount, due date and copyable payment details.
 */
export function EventPaymentCard(props: EventPaymentCardProps) {
  const t = useTranslations('events')
  const tInv = useTranslations('invoices')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    try {
      if (sessionStorage.getItem(SCROLL_TO_PAYMENT_KEY)) {
        sessionStorage.removeItem(SCROLL_TO_PAYMENT_KEY)
        ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    } catch {
      // Storage unavailable; nothing to scroll for.
    }
  }, [])

  return (
    <div
      ref={ref}
      id="event-payment"
      className={`space-y-3 rounded-lg border p-4 text-sm ${props.overdue ? 'border-[#a63d2a]' : 'border-[#c4873b] bg-[#f5ead2]/40'}`}
    >
      <div>
        <p className="text-base font-semibold">{t('payTitle', { amount: props.amount, date: props.dueLabel })}</p>
        <p className="text-muted-foreground">{t('payBody', { number: props.invoiceNumber })}</p>
        {props.seatReleaseLabel && (
          <p className="mt-1 font-medium">{t('seatReleaseNote', { date: props.seatReleaseLabel })}</p>
        )}
      </div>

      <div>
        <CopyRow label={tInv('recipient')} value={props.recipient} />
        {props.iban && <CopyRow label="IBAN" value={props.iban.replace(/\s/g, '')} display={props.iban} />}
        {props.bic && <CopyRow label="BIC" value={props.bic} />}
        <CopyRow label={tInv('toPay')} value={props.amount.replace('.', ',')} display={`${props.amount} €`} />
        <CopyRow label={tInv('reference')} value={props.reference.replace(/\s/g, '')} display={props.reference} />
        {props.barcode && <CopyRow label={t('virtualBarcode')} value={props.barcode} />}
      </div>

      <Button variant="outline" size="sm" asChild>
        <a href={`/api/members/invoices/${props.invoiceId}/pdf`} target="_blank" rel="noopener">
          <FileDown className="mr-1 h-4 w-4" />
          {tInv('downloadPdf')}
        </a>
      </Button>
    </div>
  )
}
