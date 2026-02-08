import { notFound } from 'next/navigation'
import { getTranslations, getLocale } from 'next-intl/server'
import { getMember } from '@/lib/auth-server'
import { db } from '@/db'
import { events, eventRegistrations, tastingWhiskies } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { getLocalized } from '@/lib/localize'
import { EventRsvp } from '@/components/EventRsvp'
import { registerForEvent, cancelRegistration, runLottery } from './actions'

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const member = await getMember()
  const t = await getTranslations('events')
  const locale = await getLocale()

  const event = await db.select().from(events).where(eq(events.id, id)).then((r) => r[0])
  if (!event) notFound()

  const whiskies = event.type === 'tasting'
    ? await db
        .select()
        .from(tastingWhiskies)
        .where(eq(tastingWhiskies.eventId, id))
        .orderBy(tastingWhiskies.sortOrder)
    : []

  const userReg = member
    ? await db
        .select()
        .from(eventRegistrations)
        .where(
          and(
            eq(eventRegistrations.eventId, id),
            eq(eventRegistrations.userId, member.id),
          ),
        )
        .then((r) => r.find((reg) => reg.status !== 'cancelled'))
    : null

  const isFull = event.capacity
    ? (event.registrationCount ?? 0) >= event.capacity
    : false
  const isDeadlinePassed = event.registrationDeadline
    ? new Date() > event.registrationDeadline
    : false
  const isLottery = event.allocationMethod === 'lottery'
  const isAdmin = member?.role === 'admin'

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <span className="rounded bg-amber/10 px-2 py-0.5 text-xs font-medium text-amber">
          {t(event.type as 'tasting' | 'social' | 'trip' | 'meeting' | 'other')}
        </span>
      </div>

      <h1 className="mb-4 font-serif text-3xl font-bold">
        {getLocalized(event.titleLocales, locale)}
      </h1>

      {event.summaryLocales && (
        <p className="mb-4 text-lg text-whisky-light">
          {getLocalized(event.summaryLocales, locale)}
        </p>
      )}

      <div className="mb-6 grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="font-medium">{t('date')}</span>
          <p className="text-whisky-light">
            {event.date.toLocaleDateString(locale, {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        </div>
        {event.locationLocales && (
          <div>
            <span className="font-medium">{t('location')}</span>
            <p className="text-whisky-light">{getLocalized(event.locationLocales, locale)}</p>
          </div>
        )}
        {event.capacity && (
          <div>
            <span className="font-medium">{t('capacity')}</span>
            <p className="text-whisky-light">
              {event.registrationCount ?? 0} / {event.capacity}{' '}
              {t('participants')}
              {(event.waitlistCount ?? 0) > 0 && (
                <span> ({event.waitlistCount} {t('waitlist')})</span>
              )}
            </p>
          </div>
        )}
        {event.price && (
          <div>
            <span className="font-medium">{t('price')}</span>
            <p className="text-whisky-light">€{event.price}</p>
          </div>
        )}
      </div>

      {event.descriptionLocales && (
        <div className="mb-6 text-whisky-light">
          <p>{getLocalized(event.descriptionLocales, locale)}</p>
        </div>
      )}

      {whiskies.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-3 font-serif text-xl font-semibold">{t('whiskies')}</h2>
          <div className="space-y-3">
            {whiskies.map((w) => (
              <div key={w.id} className="rounded-lg border border-border p-4">
                <p className="font-medium">{w.name}</p>
                <div className="mt-1 flex flex-wrap gap-3 text-xs text-whisky-light">
                  {w.distillery && <span>{t('distillery')}: {w.distillery}</span>}
                  {w.region && <span>{t('region')}: {w.region}</span>}
                  {w.age && <span>{t('age')}: {w.age}</span>}
                  {w.abv && <span>{t('abv')}: {w.abv}</span>}
                </div>
                {w.notesLocales && (
                  <p className="mt-2 text-sm text-whisky-light">
                    {getLocalized(w.notesLocales, locale)}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-lg border border-border p-5">
        <EventRsvp
          eventId={id}
          userStatus={userReg?.status ?? null}
          isLottery={isLottery}
          lotteryCompleted={event.lotteryCompleted ?? false}
          isFull={isFull}
          isDeadlinePassed={isDeadlinePassed}
          isAdmin={isAdmin}
          registerAction={registerForEvent}
          cancelAction={cancelRegistration}
          lotteryAction={runLottery}
        />
      </section>
    </div>
  )
}
