import Link from 'next/link'
import { getTranslations, getLocale } from 'next-intl/server'
import { db } from '@/db'
import { user, feePeriods, memberFees } from '@/db/schema'
import { sql, count, desc, eq, and, getTableColumns } from 'drizzle-orm'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/format-date'
import { Card, CardContent } from '@/components/ui/card'
import { Download } from 'lucide-react'

const PAGE_SIZE = 50

export default async function AdminMembersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; fee?: string }>
}) {
  const { page: pageParam, fee: feeParam } = await searchParams
  const feeFilter = feeParam === 'unpaid' || feeParam === 'paid' ? feeParam : 'all'
  const t = await getTranslations('admin')
  const locale = await getLocale()

  const currentPage = Math.max(1, parseInt(pageParam ?? '1', 10) || 1)
  const offset = (currentPage - 1) * PAGE_SIZE

  const latestPeriod = await db
    .select({ id: feePeriods.id, name: feePeriods.name })
    .from(feePeriods)
    .orderBy(desc(feePeriods.startDate))
    .limit(1)
    .then((r) => r[0] ?? null)

  // Left-join the latest period's fee so every member shows a fee status.
  const feeJoin = latestPeriod
    ? and(eq(memberFees.userId, user.id), eq(memberFees.feePeriodId, latestPeriod.id))
    : sql`false`
  const feeWhere =
    feeFilter === 'all' || !latestPeriod ? undefined : eq(memberFees.status, feeFilter)

  const [members, [{ total }]] = await Promise.all([
    db
      .select({ ...getTableColumns(user), feeStatus: memberFees.status })
      .from(user)
      .leftJoin(memberFees, feeJoin)
      .where(feeWhere)
      .orderBy(sql`${user.memberNumber} ASC NULLS LAST`)
      .limit(PAGE_SIZE)
      .offset(offset),
    db.select({ total: count() }).from(user).leftJoin(memberFees, feeJoin).where(feeWhere),
  ])

  const feeHref = (f: string) => {
    const sp = new URLSearchParams()
    if (f !== 'all') sp.set('fee', f)
    const qs = sp.toString()
    return qs ? `/members/admin/members?${qs}` : '/members/admin/members'
  }
  const pill = (active: boolean) =>
    `rounded-full px-3 py-1 text-sm font-medium transition-colors ${
      active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'
    }`

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const statusVariant = (status: string | null) => {
    switch (status) {
      case 'active': return 'success' as const
      case 'inactive': return 'destructive' as const
      case 'honorary': return 'warning' as const
      default: return 'default' as const
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-serif text-3xl font-bold">{t('allMembers')}</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href="/api/export/members">
              <Download className="mr-1 h-4 w-4" />
              {t('export')}
            </a>
          </Button>
          <Button asChild>
            <Link href="/members/admin/members/new">{t('addMember')}</Link>
          </Button>
        </div>
      </div>

      {latestPeriod && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">{t('feeFilterLabel', { period: latestPeriod.name })}</span>
          {(['all', 'unpaid', 'paid'] as const).map((f) => (
            <Link key={f} href={feeHref(f)} className={pill(f === feeFilter)}>
              {f === 'all' ? t('all') : t(f)}
            </Link>
          ))}
        </div>
      )}

      {members.length === 0 ? (
        <p className="text-muted-foreground">{t('noMembers')}</p>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-input text-left">
                    <th className="px-4 py-3 font-medium">{t('memberNumber')}</th>
                    <th className="px-4 py-3 font-medium">{t('name')}</th>
                    <th className="px-4 py-3 font-medium">{t('email')}</th>
                    <th className="px-4 py-3 font-medium">{t('status')}</th>
                    <th className="px-4 py-3 font-medium">{t('memberSince')}</th>
                    {latestPeriod && <th className="px-4 py-3 font-medium">{t('feeColumn')}</th>}
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => (
                    <tr key={m.id} className="border-b border-input last:border-0">
                      <td className="px-4 py-3 text-muted-foreground">{m.memberNumber ?? '—'}</td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/members/admin/members/${m.id}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {m.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{m.email}</td>
                      <td className="px-4 py-3">
                        <Badge variant={statusVariant(m.status)}>
                          {t(m.status as 'active' | 'inactive' | 'honorary')}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDate(m.memberSince, locale)}
                      </td>
                      {latestPeriod && (
                        <td className="px-4 py-3">
                          {m.feeStatus ? (
                            <Badge variant={m.feeStatus === 'paid' ? 'success' : 'warning'}>{t(m.feeStatus)}</Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-input px-4 py-3">
                <p className="text-sm text-muted-foreground">
                  {t('pageOf', { current: currentPage, total: totalPages })}
                </p>
                <div className="flex gap-2">
                  {currentPage > 1 && (
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`${feeHref(feeFilter)}${feeFilter === 'all' ? '?' : '&'}page=${currentPage - 1}`}>
                        {t('previous')}
                      </Link>
                    </Button>
                  )}
                  {currentPage < totalPages && (
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`${feeHref(feeFilter)}${feeFilter === 'all' ? '?' : '&'}page=${currentPage + 1}`}>
                        {t('next')}
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
