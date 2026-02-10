import { notFound } from 'next/navigation'
import { getTranslations, getLocale } from 'next-intl/server'
import { getMember } from '@/lib/auth-server'
import { db } from '@/db'
import { events, eventRegistrations, eventCategories } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { getLocalized } from '@/lib/localize'
import { formatDate } from '@/lib/format-date'
import { EventRsvp } from '@/components/EventRsvp'
import { EventInvoiceButton } from '@/components/admin/EventInvoiceButton'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { registerForEvent, cancelRegistration, runLottery, addGuest, removeGuest } from './actions'

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const member = await getMember()
  const t = await getTranslations('events')
  const locale = await getLocale()

  const event = await db.select().from(events).where(eq(events.id, id)).then((r) => r[0])
  if (!event) notFound()

  const category = event.categoryId
    ? await db
        .select()
        .from(eventCategories)
        .where(eq(eventCategories.id, event.categoryId))
        .then((r) => r[0])
    : null

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
  const isRegistrationNotOpenYet = event.registrationOpensAt
    ? new Date() < event.registrationOpensAt
    : false
  const isDeadlinePassed = event.registrationDeadline
    ? new Date() > event.registrationDeadline
    : false
  const isLottery = event.allocationMethod === 'lottery'
  const isAdmin = member?.role === 'admin'
  const canCancel = event.cancellationAllowed !== false &&
    (!event.cancellationDeadline || new Date() <= event.cancellationDeadline)
  const isGuestRegistrationOpen = event.guestAllowed &&
    (!event.guestRegistrationOpensAt || new Date() >= event.guestRegistrationOpensAt)

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        {category && <Badge>{getLocalized(category.nameLocales, locale)}</Badge>}
      </div>

      <h1 className="mb-4 font-serif text-3xl font-bold">
        {getLocalized(event.titleLocales, locale)}
      </h1>

      {event.summaryLocales && (
        <p className="mb-4 text-lg text-muted-foreground">
          {getLocalized(event.summaryLocales, locale)}
        </p>
      )}

      <div className="mb-6 grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="font-medium">{t('date')}</span>
          <p className="text-muted-foreground">
            {formatDate(event.date, locale, {
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
            <p className="text-muted-foreground">{getLocalized(event.locationLocales, locale)}</p>
          </div>
        )}
        {event.capacity != null && event.capacity > 0 && (
          <div>
            <span className="font-medium">{t('capacity')}</span>
            <p className="text-muted-foreground">
              {event.registrationCount ?? 0} / {event.capacity}{' '}
              {t('participants')}
              {(event.waitlistCount ?? 0) > 0 && (
                <span> ({event.waitlistCount} {t('waitlist')})</span>
              )}
            </p>
          </div>
        )}
        {event.price != null && Number(event.price) > 0 && (
          <div>
            <span className="font-medium">{t('price')}</span>
            <p className="text-muted-foreground">{event.price} EUR</p>
          </div>
        )}
      </div>

      {event.descriptionLocales && (
        <div className="mb-6 text-muted-foreground">
          <p>{getLocalized(event.descriptionLocales, locale)}</p>
        </div>
      )}

      <Card>
        <CardContent className="p-5">
          <EventRsvp
            eventId={id}
            userStatus={userReg?.status ?? null}
            isLottery={isLottery}
            lotteryCompleted={event.lotteryCompleted ?? false}
            isFull={isFull}
            isDeadlinePassed={isDeadlinePassed}
            isRegistrationNotOpenYet={isRegistrationNotOpenYet}
            registrationOpensAt={event.registrationOpensAt?.toISOString() ?? null}
            canCancel={canCancel}
            isAdmin={isAdmin}
            guestAllowed={event.guestAllowed}
            guestCount={userReg?.guestCount ?? 0}
            maxGuestsPerMember={event.maxGuestsPerMember}
            isGuestRegistrationOpen={isGuestRegistrationOpen}
            guestRegistrationOpensAt={event.guestRegistrationOpensAt?.toISOString() ?? null}
            registerAction={registerForEvent}
            cancelAction={cancelRegistration}
            lotteryAction={runLottery}
            addGuestAction={addGuest}
            removeGuestAction={removeGuest}
          />
        </CardContent>
      </Card>

      {isAdmin && event.price && Number(event.price) > 0 && (
        <Card className="mt-4">
          <CardContent className="p-5">
            <EventInvoiceButton eventId={id} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
