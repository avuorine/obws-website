'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { markFeeAsPaid, markFeeAsUnpaid } from '@/app/(frontend)/members/admin/fees/actions'
import { bulkDeactivateMembers } from '@/app/(frontend)/members/admin/members/actions'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert } from '@/components/ui/alert'
import type { EffectiveInvoiceStatus } from '@/lib/invoice-status'

export interface MemberFeeRow {
  id: string
  userId: string
  userName: string
  memberStatus: 'active' | 'inactive' | 'honorary' | null
  status: 'unpaid' | 'paid' | 'overdue'
  paidAt: Date | null
  invoiceId: string | null
  invoiceStatus: EffectiveInvoiceStatus | null
  /** Days past the invoice due date, or the period due date when never invoiced. */
  daysOverdue: number
}

interface MemberFeeTableProps {
  fees: MemberFeeRow[]
}

export function MemberFeeTable({ fees }: MemberFeeTableProps) {
  const t = useTranslations('admin')
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const feeVariant = (status: string) => {
    switch (status) {
      case 'paid': return 'success' as const
      case 'unpaid': return 'warning' as const
      default: return 'destructive' as const
    }
  }

  const memberVariant = (status: string | null) => {
    switch (status) {
      case 'active': return 'success' as const
      case 'inactive': return 'destructive' as const
      case 'honorary': return 'warning' as const
      default: return 'default' as const
    }
  }

  const invoiceVariant = (status: EffectiveInvoiceStatus | null) => {
    switch (status) {
      case 'paid': return 'success' as const
      case 'overdue': return 'destructive' as const
      case 'sent': return 'outline' as const
      case 'partial': return 'warning' as const
      case 'draft': return 'default' as const
      default: return 'outline' as const
    }
  }

  const invoiceLabel = (status: EffectiveInvoiceStatus | null) => {
    switch (status) {
      case 'draft': return t('draft')
      case 'sent': return t('sent')
      case 'partial': return t('partiallyPaid')
      case 'overdue': return t('overdue')
      case 'paid': return t('paid')
      case 'cancelled': return t('cancelled')
      default: return t('notInvoiced')
    }
  }

  // Only active members who haven't paid can be deactivated from here.
  const deactivatable = fees.filter((f) => f.status !== 'paid' && f.memberStatus === 'active')
  const allSelected = deactivatable.length > 0 && deactivatable.every((f) => selected.has(f.userId))

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(deactivatable.map((f) => f.userId)))
  }

  function toggleOne(userId: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  function handleToggleFee(feeId: string, currentStatus: string) {
    setMessage(null)
    startTransition(async () => {
      if (currentStatus === 'paid') await markFeeAsUnpaid(feeId)
      else await markFeeAsPaid(feeId)
      router.refresh()
    })
  }

  function handleBulkDeactivate() {
    const ids = Array.from(selected)
    const names = fees.filter((f) => selected.has(f.userId)).map((f) => f.userName).join('\n')
    if (!confirm(t('confirmDeactivateSelected', { count: ids.length }) + '\n\n' + names)) return
    setMessage(null)
    startTransition(async () => {
      const result = await bulkDeactivateMembers(ids)
      if (result.success) {
        setMessage({ type: 'success', text: t('membersDeactivated', { count: result.count }) })
        setSelected(new Set())
        router.refresh()
      } else {
        setMessage({ type: 'error', text: result.error ?? t('error') })
      }
    })
  }

  return (
    <div>
      {deactivatable.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-input px-4 py-3">
          <p className="text-sm text-muted-foreground">{t('selectedCount', { count: selected.size })}</p>
          <Button
            size="sm"
            variant="destructive"
            disabled={isPending || selected.size === 0}
            onClick={handleBulkDeactivate}
          >
            {t('deactivateSelected')}
          </Button>
        </div>
      )}
      {message && (
        <div className="px-4 pt-3">
          <Alert variant={message.type === 'success' ? 'success' : 'destructive'}>{message.text}</Alert>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-input text-left">
              <th className="w-10 px-4 py-3">
                {deactivatable.length > 0 && (
                  <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label={t('selectAll')} />
                )}
              </th>
              <th className="px-4 py-3 font-medium">{t('name')}</th>
              <th className="px-4 py-3 font-medium">{t('memberStatus')}</th>
              <th className="px-4 py-3 font-medium">{t('feeStatus')}</th>
              <th className="px-4 py-3 font-medium">{t('invoice')}</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {fees.map((fee) => {
              const canSelect = fee.status !== 'paid' && fee.memberStatus === 'active'
              return (
                <tr key={fee.id} className="border-b border-input last:border-0">
                  <td className="px-4 py-3">
                    {canSelect && (
                      <Checkbox
                        checked={selected.has(fee.userId)}
                        onCheckedChange={() => toggleOne(fee.userId)}
                        aria-label={fee.userName}
                      />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/members/admin/members/${fee.userId}`} className="font-medium text-primary hover:underline">
                      {fee.userName}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    {fee.memberStatus && (
                      <Badge variant={memberVariant(fee.memberStatus)}>{t(fee.memberStatus)}</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={feeVariant(fee.status)}>{t(fee.status)}</Badge>
                    {fee.status !== 'paid' && fee.daysOverdue > 0 && (
                      <span className="ml-2 text-xs text-[#a63d2a]">{t('daysOverdue', { count: fee.daysOverdue })}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {fee.invoiceId ? (
                      <Link href={`/members/admin/invoices/${fee.invoiceId}`}>
                        <Badge variant={invoiceVariant(fee.invoiceStatus)}>{invoiceLabel(fee.invoiceStatus)}</Badge>
                      </Link>
                    ) : (
                      <Badge variant="outline">{invoiceLabel(null)}</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isPending}
                      onClick={() => handleToggleFee(fee.id, fee.status)}
                    >
                      {fee.status === 'paid' ? t('markUnpaid') : t('markPaid')}
                    </Button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
