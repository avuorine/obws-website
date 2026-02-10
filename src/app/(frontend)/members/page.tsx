import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { getMember } from '@/lib/auth-server'
import { db } from '@/db'
import { events, eventRegistrations } from '@/db/schema'
import { eq, and, gte } from 'drizzle-orm'
import { getLocalized } from '@/lib/localize'
import { formatDateLong } from '@/lib/format-date'
import { getLocale } from 'next-intl/server'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export default async function MembersDashboard() {
  const member = await getMember()
  if (!member) redirect('/login')

  const t = await getTranslations('membersDashboard')
  const locale = await getLocale()

  const upcomingRegistrations = await db
    .select({
      eventId: events.id,
      title: events.titleLocales,
      date: events.date,
      status: eventRegistrations.status,
    })
    .from(eventRegistrations)
    .innerJoin(events, eq(events.id, eventRegistrations.eventId))
    .where(
      and(
        eq(eventRegistrations.userId, member.id),
        eq(eventRegistrations.status, 'registered'),
        gte(events.date, new Date()),
      ),
    )
    .orderBy(events.date)
    .limit(5)

  return (
    <div>
      <h1 className="mb-6 font-serif text-3xl font-bold">
        {t('welcome', { name: member.name })}
      </h1>

      <section className="mb-8">
        <h2 className="mb-4 font-serif text-xl font-semibold">{t('upcomingEvents')}</h2>
        {upcomingRegistrations.length === 0 ? (
          <p className="text-muted-foreground">{t('noUpcomingEvents')}</p>
        ) : (
          <ul className="space-y-3">
            {upcomingRegistrations.map((reg) => (
              <li key={reg.eventId}>
                <Link href={`/members/events/${reg.eventId}`} className="block">
                  <Card className="transition-colors hover:border-primary">
                    <CardContent className="p-4">
                      <p className="font-medium">{getLocalized(reg.title, locale)}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDateLong(reg.date, locale)}
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <Button variant="link" className="mt-4 px-0" asChild>
          <Link href="/members/events">{t('viewAllEvents')}</Link>
        </Button>
      </section>

      <section>
        <h2 className="mb-4 font-serif text-xl font-semibold">{t('quickLinks')}</h2>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" size="sm" asChild>
            <Link href="/members/profile">{t('viewProfile')}</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/members/events">{t('browseEvents')}</Link>
          </Button>
        </div>
      </section>
    </div>
  )
}
