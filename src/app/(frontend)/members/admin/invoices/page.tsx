import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { db } from '@/db'
import { invoices } from '@/db/schema'
import { desc } from 'drizzle-orm'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { InvoiceActions } from '@/components/admin/InvoiceActions'
import { BulkSendButton } from './bulk-send-button'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default async function AdminInvoicesPage() {
  const t = await getTranslations('admin')

  const allInvoices = await db
    .select()
    .from(invoices)
    .orderBy(desc(invoices.createdAt))

  const draftInvoiceIds = allInvoices
    .filter((inv) => inv.status === 'draft')
    .map((inv) => inv.id)

  const statusVariant = (status: string) => {
    switch (status) {
      case 'paid': return 'success' as const
      case 'sent': return 'outline' as const
      case 'cancelled': return 'destructive' as const
      default: return 'default' as const
    }
  }

  const typeLabel = (type: string) => {
    return type === 'membership_fee' ? t('membershipFee') : t('eventFee')
  }

  const statusLabel = (status: string) => {
    switch (status) {
      case 'draft': return t('draft')
      case 'sent': return t('sent')
      case 'paid': return t('paid')
      case 'cancelled': return t('cancelled')
      default: return status
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-serif text-3xl font-bold">{t('invoices')}</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href="/api/export/invoices">
              <Download className="mr-1 h-4 w-4" />
              {t('export')}
            </a>
          </Button>
          {draftInvoiceIds.length > 0 && (
            <BulkSendButton invoiceIds={draftInvoiceIds} />
          )}
        </div>
      </div>

      {allInvoices.length === 0 ? (
        <p className="text-muted-foreground">{t('noInvoices')}</p>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-input text-left">
                    <th className="px-4 py-3 font-medium">{t('invoiceNumber')}</th>
                    <th className="px-4 py-3 font-medium">{t('type')}</th>
                    <th className="px-4 py-3 font-medium">{t('recipient')}</th>
                    <th className="px-4 py-3 font-medium">{t('amount')}</th>
                    <th className="px-4 py-3 font-medium">{t('referenceNumber')}</th>
                    <th className="px-4 py-3 font-medium">{t('invoiceStatus')}</th>
                    <th className="px-4 py-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {allInvoices.map((inv) => (
                    <tr key={inv.id} className="border-b border-input last:border-0">
                      <td className="px-4 py-3">
                        <Link
                          href={`/members/admin/invoices/${inv.id}`}
                          className="font-medium text-primary hover:underline"
                        >
                          #{inv.invoiceNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline">{typeLabel(inv.type)}</Badge>
                      </td>
                      <td className="px-4 py-3">{inv.recipientName}</td>
                      <td className="px-4 py-3">€{inv.amount}</td>
                      <td className="px-4 py-3 font-mono text-xs">{inv.referenceNumber}</td>
                      <td className="px-4 py-3">
                        <Badge variant={statusVariant(inv.status)}>
                          {statusLabel(inv.status)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <InvoiceActions invoiceId={inv.id} status={inv.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

    </div>
  )
}
