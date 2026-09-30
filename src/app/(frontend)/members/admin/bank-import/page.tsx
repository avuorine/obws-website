import Link from 'next/link'
import { getTranslations, getLocale } from 'next-intl/server'
import { db } from '@/db'
import { bankTransactions, invoices } from '@/db/schema'
import { and, desc, eq, gt, inArray } from 'drizzle-orm'
import { BankImportForm } from '@/components/admin/BankImportForm'
import { BankReviewQueue } from '@/components/admin/BankReviewQueue'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { requireAdmin } from '@/lib/admin-guard'
import { currentConnection } from '@/lib/bank-connection'
import { remainingOf } from '@/lib/bank-matching'
import { formatDate, formatDateTime } from '@/lib/format-date'

export default async function BankImportPage() {
  await requireAdmin()
  const t = await getTranslations('admin')
  const locale = await getLocale()

  const unpaidInvoices = await db
    .select({
      id: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      referenceNumber: invoices.referenceNumber,
      amount: invoices.amount,
      paidAmount: invoices.paidAmount,
      recipientName: invoices.recipientName,
      status: invoices.status,
    })
    .from(invoices)
    .where(inArray(invoices.status, ['sent', 'draft']))

  const connection = await currentConnection()
  const review = connection
    ? await db
        .select()
        .from(bankTransactions)
        .where(eq(bankTransactions.status, 'needs_review'))
        .orderBy(desc(bankTransactions.bookingDate))
    : []
  const recent = connection
    ? await db
        .select({
          id: bankTransactions.id,
          bookingDate: bankTransactions.bookingDate,
          amount: bankTransactions.amount,
          debtorName: bankTransactions.debtorName,
          invoiceNumber: invoices.invoiceNumber,
          invoiceId: invoices.id,
        })
        .from(bankTransactions)
        .innerJoin(invoices, eq(invoices.id, bankTransactions.invoiceId))
        .where(
          and(
            eq(bankTransactions.status, 'auto_recorded'),
            gt(bankTransactions.createdAt, new Date(Date.now() - 30 * 86_400_000)),
          ),
        )
        .orderBy(desc(bankTransactions.bookingDate))
        .limit(50)
    : []

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-3xl font-bold">{t('bankImport')}</h1>

      <p className="text-sm text-muted-foreground">
        {connection?.status === 'active'
          ? t('bankSyncStatus', {
              bank: connection.aspspName,
              lastSync: connection.lastSyncedAt ? formatDateTime(connection.lastSyncedAt, locale) : '—',
              until: formatDate(connection.validUntil, locale),
            })
          : t('bankSyncOff')}{' '}
        <Link href="/members/admin/bank" className="underline">
          {t('bankManageConnection')}
        </Link>
      </p>

      {review.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t('bankReviewTitle', { count: review.length })}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <BankReviewQueue
              rows={review.map((r) => ({
                id: r.id,
                bookingDate: formatDate(r.bookingDate, locale),
                amount: r.amount,
                reference: r.reference,
                remittance: r.remittance,
                debtorName: r.debtorName,
                invoiceId: r.invoiceId,
                matchKind: r.matchKind,
              }))}
              invoices={unpaidInvoices
                .filter((inv) => inv.status === 'sent')
                .map((inv) => ({
                  id: inv.id,
                  invoiceNumber: inv.invoiceNumber,
                  recipientName: inv.recipientName,
                  remaining: remainingOf(inv).toFixed(2),
                }))}
            />
          </CardContent>
        </Card>
      )}

      {recent.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t('bankAutoRecordedTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm">
              {recent.map((r) => (
                <li key={r.id}>
                  {formatDate(r.bookingDate, locale)} · €{r.amount} · {r.debtorName ?? '—'} →{' '}
                  <Link href={`/members/admin/invoices/${r.invoiceId}`} className="text-primary hover:underline">
                    #{r.invoiceNumber}
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <BankImportForm unpaidInvoices={unpaidInvoices} />
    </div>
  )
}
