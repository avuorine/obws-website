'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { recordBankTransaction, ignoreBankTransaction } from '@/app/(frontend)/members/admin/bank-import/actions'

export interface ReviewRow {
  id: string
  bookingDate: string
  amount: string
  reference: string | null
  remittance: string | null
  debtorName: string | null
  invoiceId: string | null
  matchKind: string | null
}

interface Props {
  rows: ReviewRow[]
  invoices: { id: string; invoiceNumber: number; recipientName: string; remaining: string }[]
}

export function BankReviewQueue({ rows, invoices }: Props) {
  const t = useTranslations('admin')
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [choice, setChoice] = useState<Record<string, string>>(() =>
    Object.fromEntries(rows.map((r) => [r.id, r.invoiceId ?? ''])),
  )
  const [error, setError] = useState<string | null>(null)

  const run = (fn: () => Promise<{ success: boolean; error?: string }>) =>
    startTransition(async () => {
      setError(null)
      const res = await fn()
      if (res.success) router.refresh()
      else setError(res.error === 'invoiceNotFound' || res.error === 'bankTransactionNotFound' ? t(res.error) : t('error'))
    })

  return (
    <div className="overflow-x-auto">
      <table className="data-table w-full text-sm">
        <thead>
          <tr className="border-b border-input text-left">
            <th className="px-4 py-3 font-medium">{t('bankDate')}</th>
            <th className="px-4 py-3 font-medium">{t('bankAmount')}</th>
            <th className="px-4 py-3 font-medium">{t('bankPayer')}</th>
            <th className="px-4 py-3 font-medium">{t('invoiceMatch')}</th>
            <th className="px-4 py-3 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-input last:border-0 align-top">
              <td className="px-4 py-3 text-muted-foreground">{r.bookingDate}</td>
              <td className="px-4 py-3">€{r.amount}</td>
              <td className="min-w-48 whitespace-normal px-4 py-3">
                {r.debtorName ?? '—'}
                <span className="block font-mono text-xs text-muted-foreground">{r.reference || '—'}</span>
                {r.remittance && <span className="block text-xs text-muted-foreground">{r.remittance}</span>}
              </td>
              <td className="px-4 py-3">
                <select
                  className="h-9 rounded-lg border border-input bg-background px-2 text-sm"
                  value={choice[r.id] ?? ''}
                  onChange={(e) => setChoice((c) => ({ ...c, [r.id]: e.target.value }))}
                >
                  <option value="">—</option>
                  {invoices.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      #{inv.invoiceNumber} {inv.recipientName} (€{inv.remaining})
                    </option>
                  ))}
                </select>
                {r.matchKind && (
                  <Badge variant="warning" className="ml-2">
                    {t(`bankMatch_${r.matchKind}`)}
                  </Badge>
                )}
              </td>
              <td className="px-4 py-3">
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={isPending || !choice[r.id]}
                    onClick={() => run(() => recordBankTransaction(r.id, choice[r.id]))}
                  >
                    {t('bankRecord')}
                  </Button>
                  <Button size="sm" variant="outline" disabled={isPending} onClick={() => run(() => ignoreBankTransaction(r.id))}>
                    {t('bankIgnore')}
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {error && <p className="px-4 py-2 text-sm text-destructive">{error}</p>}
    </div>
  )
}
