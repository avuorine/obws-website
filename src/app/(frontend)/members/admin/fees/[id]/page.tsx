import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getTranslations, getLocale } from 'next-intl/server'
import { db } from '@/db'
import { feePeriods, memberFees, user, invoices } from '@/db/schema'
import { eq, and, ne, desc } from 'drizzle-orm'
import { effectiveInvoiceStatus, daysOverdue } from '@/lib/invoice-status'
import { formatDate } from '@/lib/format-date'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MemberFeeTable, type MemberFeeRow } from '@/components/admin/MemberFeeTable'
import { FeePeriodActions } from './fee-period-actions'
import { ArrowLeft } from 'lucide-react'

export default async function FeePeriodDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ filter?: string }>
}) {
  const { id } = await params
  const { filter } = await searchParams
  const showUnpaidOnly = filter === 'unpaid'
  const t = await getTranslations('admin')
  const locale = await getLocale()

  const period = await db.select().from(feePeriods).where(eq(feePeriods.id, id)).then((r) => r[0])
  if (!period) notFound()

  const feeRows = await db
    .select({
      id: memberFees.id,
      userId: memberFees.userId,
      status: memberFees.status,
      paidAt: memberFees.paidAt,
      userName: user.name,
      memberStatus: user.status,
    })
    .from(memberFees)
    .innerJoin(user, eq(memberFees.userId, user.id))
    .where(eq(memberFees.feePeriodId, id))
    .orderBy(user.name)

  // Latest non-cancelled membership invoice per member for this period.
  const periodInvoices = await db
    .select({ id: invoices.id, userId: invoices.userId, status: invoices.status, dueDate: invoices.dueDate })
    .from(invoices)
    .where(
      and(eq(invoices.feePeriodId, id), eq(invoices.type, 'membership_fee'), ne(invoices.status, 'cancelled')),
    )
    .orderBy(desc(invoices.createdAt))
  const invoiceByUser = new Map<string, (typeof periodInvoices)[number]>()
  for (const inv of periodInvoices) if (!invoiceByUser.has(inv.userId)) invoiceByUser.set(inv.userId, inv)

  const now = new Date()
  const fees: MemberFeeRow[] = feeRows.map((f) => {
    const inv = invoiceByUser.get(f.userId) ?? null
    return {
      ...f,
      invoiceId: inv?.id ?? null,
      invoiceStatus: inv ? effectiveInvoiceStatus(inv, now) : null,
      daysOverdue: f.status === 'paid' ? 0 : daysOverdue(inv?.dueDate ?? period.dueDate, now),
    }
  })

  const paidCount = fees.filter((f) => f.status === 'paid').length
  const unpaidCount = fees.length - paidCount
  const visibleFees = showUnpaidOnly ? fees.filter((f) => f.status !== 'paid') : fees

  const pill = (active: boolean) =>
    `rounded-full px-3 py-1 text-sm font-medium transition-colors ${
      active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'
    }`

  return (
    <div>
      <Link
        href="/members/admin/fees"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('back')}
      </Link>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{period.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <div>
              <p className="text-muted-foreground">{t('amount')}</p>
              <p>€{period.amount}</p>
            </div>
            <div>
              <p className="text-muted-foreground">{t('startDate')}</p>
              <p>{formatDate(period.startDate, locale)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">{t('endDate')}</p>
              <p>{formatDate(period.endDate, locale)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">{t('dueDate')}</p>
              <p>{formatDate(period.dueDate, locale)}</p>
            </div>
          </div>
          {fees.length > 0 && (
            <div className="mt-3">
              <div className="mb-1 flex justify-between text-sm">
                <span className="text-muted-foreground">{t('paymentProgress')}</span>
                <span>{paidCount}/{fees.length}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${fees.length > 0 ? (paidCount / fees.length) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}

          <FeePeriodActions feePeriodId={id} />
        </CardContent>
      </Card>

      {fees.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>{t('memberFees')}</CardTitle>
              <div className="flex gap-2">
                <Link href={`/members/admin/fees/${id}`} className={pill(!showUnpaidOnly)}>
                  {t('all')} ({fees.length})
                </Link>
                <Link href={`/members/admin/fees/${id}?filter=unpaid`} className={pill(showUnpaidOnly)}>
                  {t('unpaid')} ({unpaidCount})
                </Link>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {visibleFees.length === 0 ? (
              <p className="px-4 pb-4 text-sm text-muted-foreground">{t('allFeesPaid')}</p>
            ) : (
              <MemberFeeTable fees={visibleFees} />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
