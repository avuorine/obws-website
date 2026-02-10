import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getTranslations, getLocale } from 'next-intl/server'
import { db } from '@/db'
import { invoices } from '@/db/schema'
import { eq } from 'drizzle-orm'
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
            </div>
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
    </div>
  )
}
