import Link from 'next/link'
import { getTranslations, getLocale } from 'next-intl/server'
import { db } from '@/db'
import { feePeriods, memberFees } from '@/db/schema'
import { eq, sql, desc } from 'drizzle-orm'
import { formatDate } from '@/lib/format-date'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default async function AdminFeesPage() {
  const t = await getTranslations('admin')
  const locale = await getLocale()

  const periods = await db
    .select()
    .from(feePeriods)
    .orderBy(desc(feePeriods.startDate))

  // Get payment stats per period
  const stats = await Promise.all(
    periods.map(async (period) => {
      const fees = await db
        .select({
          total: sql<number>`count(*)`,
          paid: sql<number>`count(*) filter (where ${memberFees.status} = 'paid')`,
        })
        .from(memberFees)
        .where(eq(memberFees.feePeriodId, period.id))
        .then((r) => r[0])

      return { ...period, total: Number(fees.total), paid: Number(fees.paid) }
    }),
  )

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-serif text-3xl font-bold">{t('feePeriods')}</h1>
        <Button asChild>
          <Link href="/members/admin/fees/new">{t('createFeePeriod')}</Link>
        </Button>
      </div>

      {stats.length === 0 ? (
        <p className="text-muted-foreground">{t('noFeePeriods')}</p>
      ) : (
        <div className="grid gap-4">
          {stats.map((period) => (
            <Link key={period.id} href={`/members/admin/fees/${period.id}`}>
              <Card className="transition-colors hover:border-primary/50">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>{period.name}</CardTitle>
                    <span className="text-lg font-semibold">€{period.amount}</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
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
                  {period.total > 0 && (
                    <div className="mt-3">
                      <div className="mb-1 flex justify-between text-sm">
                        <span className="text-muted-foreground">{t('paymentProgress')}</span>
                        <span>{period.paid}/{period.total}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${(period.paid / period.total) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
