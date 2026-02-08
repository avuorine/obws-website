import { getTranslations, getLocale } from 'next-intl/server'
import { getMember } from '@/lib/auth-server'
import { db } from '@/db'
import { events, eventRegistrations } from '@/db/schema'
import { eq, gte, and } from 'drizzle-orm'
import { EventCard } from '@/components/EventCard'

export default async function EventsPage() {
  const member = await getMember()
  const t = await getTranslations('events')
  const locale = await getLocale()

  const allEvents = await db
    .select()
    .from(events)
    .where(and(eq(events.status, 'published'), gte(events.date, new Date())))
    .orderBy(events.date)

  const userRegistrations = member
    ? await db
        .select({ eventId: eventRegistrations.eventId, status: eventRegistrations.status })
        .from(eventRegistrations)
        .where(
          and(
            eq(eventRegistrations.userId, member.id),
            eq(eventRegistrations.status, 'registered'),
          ),
        )
    : []

  const regMap = new Map(userRegistrations.map((r) => [r.eventId, r.status]))

  return (
    <div>
      <h1 className="mb-6 font-serif text-3xl font-bold">{t('title')}</h1>

      {allEvents.length === 0 ? (
        <p className="text-whisky-light">{t('noEvents')}</p>
      ) : (
        <div className="space-y-4">
          {allEvents.map((event) => (
            <EventCard
              key={event.id}
              id={event.id}
              titleLocales={event.titleLocales}
              summaryLocales={event.summaryLocales}
              date={event.date}
              type={event.type}
              capacity={event.capacity}
              registrationCount={event.registrationCount}
              locale={locale}
              userStatus={regMap.get(event.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
