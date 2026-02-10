import { getTranslations, getLocale } from 'next-intl/server'
import { getMember } from '@/lib/auth-server'
import { db } from '@/db'
import { events, eventRegistrations, eventCategories } from '@/db/schema'
import { eq, gte, and } from 'drizzle-orm'
import { getLocalized } from '@/lib/localize'
import { formatMonthYear } from '@/lib/format-date'
import { EventCard } from '@/components/EventCard'

export default async function EventsPage() {
  const member = await getMember()
  const t = await getTranslations('events')
  const locale = await getLocale()

  const allEvents = await db
    .select({
      id: events.id,
      titleLocales: events.titleLocales,
      summaryLocales: events.summaryLocales,
      date: events.date,
      capacity: events.capacity,
      registrationCount: events.registrationCount,
      categoryNameLocales: eventCategories.nameLocales,
    })
    .from(events)
    .leftJoin(eventCategories, eq(events.categoryId, eventCategories.id))
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
        <p className="text-muted-foreground">{t('noEvents')}</p>
      ) : (
        <div className="space-y-4">
          {allEvents.map((event, i) => {
            const monthKey = `${event.date.getFullYear()}-${event.date.getMonth()}`
            const prevMonthKey = i > 0
              ? `${allEvents[i - 1].date.getFullYear()}-${allEvents[i - 1].date.getMonth()}`
              : null
            const showHeader = monthKey !== prevMonthKey

            return (
              <div key={event.id}>
                {showHeader && (
                  <h2 className={`${i > 0 ? 'mt-6' : ''} mb-3 font-serif text-xl font-semibold capitalize`}>
                    {formatMonthYear(event.date, locale)}
                  </h2>
                )}
                <EventCard
                  id={event.id}
                  titleLocales={event.titleLocales}
                  summaryLocales={event.summaryLocales}
                  date={event.date}
                  categoryName={getLocalized(event.categoryNameLocales, locale)}
                  capacity={event.capacity}
                  registrationCount={event.registrationCount}
                  locale={locale}
                  userStatus={regMap.get(event.id)}
                />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
