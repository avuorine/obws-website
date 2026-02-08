import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { getMember } from '@/lib/auth-server'
import { db } from '@/db'
import { events, eventRegistrations } from '@/db/schema'
import { eq, and, gte } from 'drizzle-orm'
import { getLocalized } from '@/lib/localize'
import { getLocale } from 'next-intl/server'

export default async function MembersDashboard() {
  const member = await getMember()
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
        eq(eventRegistrations.userId, member!.id),
        eq(eventRegistrations.status, 'registered'),
        gte(events.date, new Date()),
      ),
    )
    .orderBy(events.date)
    .limit(5)

  return (
    <div>
      <h1 className="mb-6 font-serif text-3xl font-bold">
        {t('welcome', { name: member!.name })}
      </h1>

      <section className="mb-8">
        <h2 className="mb-4 font-serif text-xl font-semibold">{t('upcomingEvents')}</h2>
        {upcomingRegistrations.length === 0 ? (
          <p className="text-whisky-light">{t('noUpcomingEvents')}</p>
        ) : (
          <ul className="space-y-3">
            {upcomingRegistrations.map((reg) => (
              <li key={reg.eventId}>
                <Link
                  href={`/members/events/${reg.eventId}`}
                  className="block rounded-lg border border-border p-4 transition-colors hover:border-amber"
                >
                  <p className="font-medium">{getLocalized(reg.title, locale)}</p>
                  <p className="text-sm text-whisky-light">
                    {reg.date.toLocaleDateString(locale, {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <Link
          href="/members/events"
          className="mt-4 inline-block text-sm text-amber hover:underline"
        >
          {t('viewAllEvents')}
        </Link>
      </section>

      <section>
        <h2 className="mb-4 font-serif text-xl font-semibold">{t('quickLinks')}</h2>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/members/profile"
            className="rounded-lg border border-border px-4 py-2 text-sm transition-colors hover:border-amber"
          >
            {t('viewProfile')}
          </Link>
          <Link
            href="/members/directory"
            className="rounded-lg border border-border px-4 py-2 text-sm transition-colors hover:border-amber"
          >
            {t('viewDirectory')}
          </Link>
          <Link
            href="/members/events"
            className="rounded-lg border border-border px-4 py-2 text-sm transition-colors hover:border-amber"
          >
            {t('browseEvents')}
          </Link>
        </div>
      </section>
    </div>
  )
}
