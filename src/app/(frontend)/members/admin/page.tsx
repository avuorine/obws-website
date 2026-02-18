import Link from 'next/link'
import { getTranslations, getLocale } from 'next-intl/server'
import { db } from '@/db'
import { user, events, invoices, feePeriods, memberFees } from '@/db/schema'
import { sql, eq, gte, inArray, desc } from 'drizzle-orm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Users, UserPlus, Calendar, FileText, Receipt, Mail } from 'lucide-react'
import { formatDate } from '@/lib/format-date'

export default async function AdminDashboardPage() {
  const t = await getTranslations('admin')
  const locale = await getLocale()

  const startOfYear = new Date(new Date().getFullYear(), 0, 1)

  const [
    [{ activeCount }],
    [{ newThisYear }],
    [{ upcomingCount }],
    [{ unpaidCount, unpaidSum }],
    latestPeriod,
    recentInvoicesList,
    recentMembersList,
  ] = await Promise.all([
    db
      .select({ activeCount: sql<number>`count(*)::int` })
      .from(user)
      .where(eq(user.status, 'active')),
    db
      .select({ newThisYear: sql<number>`count(*)::int` })
      .from(user)
      .where(
        sql`${user.memberSince} >= ${startOfYear} AND ${user.status} IN ('active', 'honorary')`,
      ),
    db
      .select({ upcomingCount: sql<number>`count(*)::int` })
      .from(events)
      .where(
        sql`${events.status} = 'published' AND ${events.date} >= now()`,
      ),
    db
      .select({
        unpaidCount: sql<number>`count(*)::int`,
        unpaidSum: sql<string>`coalesce(sum(${invoices.amount}), 0)`,
      })
      .from(invoices)
      .where(inArray(invoices.status, ['sent', 'draft'])),
    // Latest fee period with stats
    db
      .select()
      .from(feePeriods)
      .orderBy(desc(feePeriods.startDate))
      .limit(1)
      .then((r) => r[0] ?? null),
    // Recent invoices
    db
      .select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        recipientName: invoices.recipientName,
        amount: invoices.amount,
        sentAt: invoices.sentAt,
      })
      .from(invoices)
      .where(eq(invoices.status, 'sent'))
      .orderBy(desc(invoices.sentAt))
      .limit(5),
    // Recent members
    db
      .select({
        id: user.id,
        name: user.name,
        memberNumber: user.memberNumber,
        memberSince: user.memberSince,
      })
      .from(user)
      .where(inArray(user.status, ['active', 'honorary']))
      .orderBy(desc(user.memberSince))
      .limit(5),
  ])

  // Fee period progress
  let periodStats: { name: string; paid: number; total: number } | null = null
  if (latestPeriod) {
    const [{ total, paid }] = await db
      .select({
        total: sql<number>`count(*)::int`,
        paid: sql<number>`count(*) filter (where ${memberFees.status} = 'paid')::int`,
      })
      .from(memberFees)
      .where(eq(memberFees.feePeriodId, latestPeriod.id))

    periodStats = { name: latestPeriod.name, paid: Number(paid), total: Number(total) }
  }

  const statCards = [
    { label: t('totalActiveMembers'), value: activeCount, icon: Users },
    { label: t('newMembersThisYear'), value: newThisYear, icon: UserPlus },
    { label: t('upcomingEvents'), value: upcomingCount, icon: Calendar },
    {
      label: t('unpaidInvoicesCount'),
      value: `${unpaidCount} (€${Number(unpaidSum).toFixed(0)})`,
      icon: FileText,
    },
  ]

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-3xl font-bold">{t('dashboard')}</h1>

      {/* Stats cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.label}>
              <CardContent className="flex items-center gap-4 p-4">
                <div className="rounded-lg bg-muted p-2">
                  <Icon className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-bold">{stat.value}</p>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Fee period progress */}
      {periodStats && periodStats.total > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t('currentFeePeriod')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-2 font-medium">{periodStats.name}</p>
            <div className="mb-1 flex justify-between text-sm">
              <span className="text-muted-foreground">{t('paymentProgress')}</span>
              <span>
                {periodStats.paid}/{periodStats.total}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{
                  width: `${(periodStats.paid / periodStats.total) * 100}%`,
                }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent activity */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Recent invoices */}
        <Card>
          <CardHeader>
            <CardTitle>{t('recentInvoices')}</CardTitle>
          </CardHeader>
          <CardContent>
            {recentInvoicesList.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('noInvoices')}</p>
            ) : (
              <div className="space-y-3">
                {recentInvoicesList.map((inv) => (
                  <Link
                    key={inv.id}
                    href={`/members/admin/invoices/${inv.id}`}
                    className="flex items-center justify-between rounded-md p-2 text-sm transition-colors hover:bg-accent"
                  >
                    <div>
                      <span className="font-medium">#{inv.invoiceNumber}</span>
                      <span className="ml-2 text-muted-foreground">
                        {inv.recipientName}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="font-medium">€{inv.amount}</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {formatDate(inv.sentAt, locale)}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent members */}
        <Card>
          <CardHeader>
            <CardTitle>{t('recentMembers')}</CardTitle>
          </CardHeader>
          <CardContent>
            {recentMembersList.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('noMembers')}</p>
            ) : (
              <div className="space-y-3">
                {recentMembersList.map((m) => (
                  <Link
                    key={m.id}
                    href={`/members/admin/members/${m.id}`}
                    className="flex items-center justify-between rounded-md p-2 text-sm transition-colors hover:bg-accent"
                  >
                    <div>
                      <span className="font-medium">{m.name}</span>
                      {m.memberNumber && (
                        <Badge variant="outline" className="ml-2">
                          #{m.memberNumber}
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(m.memberSince, locale)}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick actions */}
      <Card>
        <CardHeader>
          <CardTitle>{t('quickActions')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/members/admin/members/new">
                <UserPlus className="mr-1 h-4 w-4" />
                {t('addMember')}
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/members/admin/events/new">
                <Calendar className="mr-1 h-4 w-4" />
                {t('addEvent')}
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/members/admin/mass-email">
                <Mail className="mr-1 h-4 w-4" />
                {t('massEmail')}
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
