'use client'

import { useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { markFeeAsPaid, markFeeAsUnpaid } from '@/app/(frontend)/members/admin/fees/actions'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface MemberFee {
  id: string
  userName: string
  status: 'unpaid' | 'paid' | 'overdue'
  paidAt: Date | null
}

interface MemberFeeTableProps {
  fees: MemberFee[]
}

export function MemberFeeTable({ fees }: MemberFeeTableProps) {
  const t = useTranslations('admin')
  const [isPending, startTransition] = useTransition()

  const statusVariant = (status: string) => {
    switch (status) {
      case 'paid': return 'success' as const
      case 'unpaid': return 'warning' as const
      case 'overdue': return 'destructive' as const
      default: return 'default' as const
    }
  }

  function handleToggle(feeId: string, currentStatus: string) {
    startTransition(async () => {
      if (currentStatus === 'paid') {
        await markFeeAsUnpaid(feeId)
      } else {
        await markFeeAsPaid(feeId)
      }
    })
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-input text-left">
            <th className="px-4 py-3 font-medium">{t('name')}</th>
            <th className="px-4 py-3 font-medium">{t('status')}</th>
            <th className="px-4 py-3 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {fees.map((fee) => (
            <tr key={fee.id} className="border-b border-input last:border-0">
              <td className="px-4 py-3">{fee.userName}</td>
              <td className="px-4 py-3">
                <Badge variant={statusVariant(fee.status)}>
                  {t(fee.status as 'paid' | 'unpaid' | 'overdue')}
                </Badge>
              </td>
              <td className="px-4 py-3 text-right">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isPending}
                  onClick={() => handleToggle(fee.id, fee.status)}
                >
                  {fee.status === 'paid' ? t('markUnpaid') : t('markPaid')}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
