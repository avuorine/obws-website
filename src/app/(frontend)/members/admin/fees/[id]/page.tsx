import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getTranslations, getLocale } from 'next-intl/server'
import { db } from '@/db'
import { feePeriods, memberFees, user } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { formatDate } from '@/lib/format-date'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MemberFeeTable } from '@/components/admin/MemberFeeTable'
import { FeePeriodActions } from './fee-period-actions'
import { ArrowLeft } from 'lucide-react'

export default async function FeePeriodDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const t = await getTranslations('admin')
  const locale = await getLocale()

  const period = await db.select().from(feePeriods).where(eq(feePeriods.id, id)).then((r) => r[0])
  if (!period) notFound()

  const fees = await db
    .select({
      id: memberFees.id,
      status: memberFees.status,
      paidAt: memberFees.paidAt,
      userName: user.name,
    })
    .from(memberFees)
    .innerJoin(user, eq(memberFees.userId, user.id))
    .where(eq(memberFees.feePeriodId, id))
    .orderBy(user.name)

  const paidCount = fees.filter((f) => f.status === 'paid').length

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
            <CardTitle>{t('memberFees')}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <MemberFeeTable fees={fees} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
