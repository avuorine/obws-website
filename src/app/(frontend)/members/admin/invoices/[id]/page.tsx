import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getTranslations, getLocale } from 'next-intl/server'
import { db } from '@/db'
import { invoices, eventRegistrations, invoicePayments } from '@/db/schema'
import { eq, desc } from 'drizzle-orm'
import { remainingAmount } from '@/lib/invoice-status'
import { requireAdmin } from '@/lib/admin-guard'
import { formatReferenceNumber } from '@/lib/reference-number'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/format-date'
import { InvoiceActions } from '@/components/admin/InvoiceActions'
import { ArrowLeft, Download } from 'lucide-react'

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireAdmin()
  const { id } = await params
  const t = await getTranslations('admin')
  const locale = await getLocale()

  const invoice = await db
    .select()
    .from(invoices)
    .where(eq(invoices.id, id))
    .then((r) => r[0])

  if (!invoice) notFound()

  const payments = await db
    .select()
    .from(invoicePayments)
    .where(eq(invoicePayments.invoiceId, id))
    .orderBy(desc(invoicePayments.paidAt))
  const remaining = remainingAmount(invoice)

  const eventId = invoice.eventRegistrationId
    ? await db
        .select({ eventId: eventRegistrations.eventId })
        .from(eventRegistrations)
        .where(eq(eventRegistrations.id, invoice.eventRegistrationId))
        .then((r) => r[0]?.eventId ?? null)
    : null

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

  const fmtDate = (date: Date | null) => formatDate(date, locale)

  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        <Link
          href="/members/admin/invoices"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('back')}
        </Link>
      </div>

      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-serif text-3xl font-bold">
          {t('invoiceDetails')} #{invoice.invoiceNumber}
        </h1>
        <div className="flex items-center gap-2">
          <a
            href={`/api/invoices/${invoice.id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" />
              {t('downloadPdf')}
            </Button>
          </a>
          <InvoiceActions invoiceId={invoice.id} status={invoice.status} />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('invoiceDetails')}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm font-medium text-muted-foreground">{t('invoiceNumber')}</dt>
              <dd className="mt-1">#{invoice.invoiceNumber}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">{t('type')}</dt>
              <dd className="mt-1">
                <Badge variant="outline">{typeLabel(invoice.type)}</Badge>
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">{t('invoiceStatus')}</dt>
              <dd className="mt-1">
                <Badge variant={statusVariant(invoice.status)}>
                  {statusLabel(invoice.status)}
                </Badge>
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">{t('recipient')}</dt>
              <dd className="mt-1">{invoice.recipientName}</dd>
              <dd className="text-sm text-muted-foreground">{invoice.recipientEmail}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-sm font-medium text-muted-foreground">{t('description')}</dt>
              <dd className="mt-1">{invoice.description}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">{t('amount')}</dt>
              <dd className="mt-1 text-lg font-semibold">&euro;{invoice.amount}</dd>
              {Number(invoice.paidAmount) > 0 && invoice.status !== 'paid' && (
                <dd className="text-sm text-[#8b6914]">{t('paidOfTotal', { paid: invoice.paidAmount, total: invoice.amount })}</dd>
              )}
              {invoice.seatCount != null && (
                <dd className="text-sm text-muted-foreground">{t('seatsBilled', { count: invoice.seatCount })}</dd>
              )}
            </div>
            {eventId && (
              <div>
                <dt className="text-sm font-medium text-muted-foreground">{t('event')}</dt>
                <dd className="mt-1">
                  <Link href={`/members/admin/events/${eventId}`} className="text-primary hover:underline">
                    {t('viewEvent')}
                  </Link>
                </dd>
              </div>
            )}
            <div>
              <dt className="text-sm font-medium text-muted-foreground">{t('referenceNumber')}</dt>
              <dd className="mt-1 font-mono text-sm">{formatReferenceNumber(invoice.referenceNumber)}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">{t('dueDate')}</dt>
              <dd className="mt-1">{fmtDate(invoice.dueDate)}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">{t('createdAt')}</dt>
              <dd className="mt-1">{fmtDate(invoice.createdAt)}</dd>
            </div>
            {invoice.sentAt && (
              <div>
                <dt className="text-sm font-medium text-muted-foreground">{t('sentAt')}</dt>
                <dd className="mt-1">{fmtDate(invoice.sentAt)}</dd>
              </div>
            )}
            {invoice.paidAt && (
              <div>
                <dt className="text-sm font-medium text-muted-foreground">{t('paidAt')}</dt>
                <dd className="mt-1">{fmtDate(invoice.paidAt)}</dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{t('payments')}</CardTitle>
            {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
              <span className="text-sm text-muted-foreground">{t('remainingAmount', { amount: remaining.toFixed(2) })}</span>
            )}
            {Number(invoice.paidAmount) > Number(invoice.amount) + 0.005 && (
              <span className="text-sm text-[#a63d2a]">
                {t('overpaidBy', { amount: (Number(invoice.paidAmount) - Number(invoice.amount)).toFixed(2) })}
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {payments.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">{t('noPayments')}</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-input text-left">
                  <th className="px-6 py-3 font-medium">{t('paidAt')}</th>
                  <th className="px-6 py-3 font-medium">{t('amount')}</th>
                  <th className="px-6 py-3 font-medium">{t('referenceNumber')}</th>
                  <th className="px-6 py-3 font-medium">{t('paymentSource')}</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-b border-input last:border-0">
                    <td className="px-6 py-3">{fmtDate(p.paidAt)}</td>
                    <td className="px-6 py-3">&euro;{p.amount}</td>
                    <td className="px-6 py-3 font-mono text-xs text-muted-foreground">{p.reference ?? '—'}</td>
                    <td className="px-6 py-3">
                      <Badge variant="outline">{p.source === 'bank_import' ? t('sourceBank') : t('sourceManual')}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
