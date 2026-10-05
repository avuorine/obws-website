import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getTranslations, getLocale } from 'next-intl/server'
import { getMember } from '@/lib/auth-server'
import { db } from '@/db'
import { events, eventRegistrations, eventCategories, invoices } from '@/db/schema'
import { eq, and, ne } from 'drizzle-orm'
import { getLocalized } from '@/lib/localize'
import { formatDate, formatDateTime, formatTime } from '@/lib/format-date'
import { getDatePartsInTz } from '@/lib/timezone'
import { EventRsvp } from '@/components/EventRsvp'
import { EventPaymentCard } from '@/components/EventPaymentCard'
import { getSettings } from '@/lib/settings'
import { generateVirtualBarcode } from '@/lib/invoice-email'
import { formatReferenceNumber } from '@/lib/reference-number'
import { getOverdueBalance } from '@/lib/overdue-balance'
import { isRegistrationClosed, memberCancelBlockReason, signupRule } from '@/lib/event-deadlines'
import { effectiveInvoiceStatus, remainingAmount } from '@/lib/invoice-status'
import { Pencil } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { registerForEvent, cancelRegistration, addGuest, removeGuest } from './actions'

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const member = await getMember()
  const t = await getTranslations('events')
  const tAdmin = await getTranslations('admin')
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

  const hasOverdueInvoices = member ? (await getOverdueBalance(member.id)) !== null : false

  const isFull = event.capacity
    ? (event.registrationCount ?? 0) >= event.capacity
    : false
  const isRegistrationNotOpenYet = event.registrationOpensAt
    ? new Date() < event.registrationOpensAt
    : false
  const isDeadlinePassed = isRegistrationClosed(event)
  const isLottery = event.allocationMethod === 'lottery'
  const isAdmin = member?.role === 'admin'
  const canCancel = userReg ? memberCancelBlockReason(event, userReg) === null : false
  // Registrations from before binding signups keep the event's cancellation deadline.
  const showCancellationDeadline = !!event.cancellationDeadline && !!userReg && !userReg.autoInvoice

  const settings = await getSettings()

  // A binding signup's invoices for this event, so the member sees what to
  // pay and when the seat would be released.
  const myInvoices = userReg?.autoInvoice
    ? await db
        .select({
          id: invoices.id,
          invoiceNumber: invoices.invoiceNumber,
          status: invoices.status,
          amount: invoices.amount,
          paidAmount: invoices.paidAmount,
          dueDate: invoices.dueDate,
          seatReleaseAt: invoices.seatReleaseAt,
          referenceNumber: invoices.referenceNumber,
        })
        .from(invoices)
        .where(and(eq(invoices.eventRegistrationId, userReg.id), ne(invoices.status, 'cancelled')))
        .orderBy(invoices.createdAt)
    : []
  const isGuestRegistrationOpen = event.guestAllowed &&
    (!event.guestRegistrationOpensAt || new Date() >= event.guestRegistrationOpensAt)

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {category && <Badge>{getLocalized(category.nameLocales, locale)}</Badge>}
        </div>
        {isAdmin && (
          <Link
            href={`/members/admin/events/${id}`}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <Pencil className="h-4 w-4" />
            {tAdmin('editEvent')}
          </Link>
        )}
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
            {formatDateTime(event.date, locale)}
            {event.endDate && (
              <>
                {' — '}
                {(() => {
                  const startParts = getDatePartsInTz(event.date)
                  const endParts = getDatePartsInTz(event.endDate!)
                  return startParts.year === endParts.year && startParts.month === endParts.month && startParts.day === endParts.day
                })()
                  ? formatTime(event.endDate, locale)
                  : formatDateTime(event.endDate, locale)}
              </>
            )}
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
        {event.registrationDeadline && (
          <div>
            <span className="font-medium">{t('registrationDeadline')}</span>
            <p className="text-muted-foreground">
              {formatDateTime(event.registrationDeadline, locale)}
            </p>
          </div>
        )}
        {showCancellationDeadline && event.cancellationDeadline && (
          <div>
            <span className="font-medium">{t('cancellationDeadline')}</span>
            <p className="text-muted-foreground">
              {formatDateTime(event.cancellationDeadline, locale)}
            </p>
          </div>
        )}
      </div>

      {event.descriptionLocales && (
        <div className="mb-6 text-muted-foreground">
          <p className="whitespace-pre-wrap">{getLocalized(event.descriptionLocales, locale)}</p>
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
            guestAllowed={event.guestAllowed}
            guestCount={userReg?.guestCount ?? 0}
            maxGuestsPerMember={event.maxGuestsPerMember}
            isGuestRegistrationOpen={isGuestRegistrationOpen}
            guestRegistrationOpensAt={event.guestRegistrationOpensAt?.toISOString() ?? null}
            hasOverdueInvoices={hasOverdueInvoices}
            eventTitle={getLocalized(event.titleLocales, locale)}
            eventDate={event.date.toISOString()}
            price={event.price != null && Number(event.price) > 0 ? event.price : null}
            bindingRule={signupRule(event, userReg ?? null)}
            cancellationDeadline={event.cancellationDeadline?.toISOString() ?? null}
            registerAction={registerForEvent}
            cancelAction={cancelRegistration}
            addGuestAction={addGuest}
            removeGuestAction={removeGuest}
          />
          {myInvoices.length > 0 && (
            <div className="mt-4 space-y-3 border-t pt-4 text-sm">
              {myInvoices.map((inv) => {
                const status = effectiveInvoiceStatus(inv)
                if (status === 'sent' || status === 'partial' || status === 'overdue') {
                  const remaining = remainingAmount(inv).toFixed(2)
                  return (
                    <EventPaymentCard
                      key={inv.id}
                      invoiceId={inv.id}
                      invoiceNumber={inv.invoiceNumber}
                      amount={remaining}
                      dueLabel={formatDate(inv.dueDate, locale)}
                      seatReleaseLabel={inv.seatReleaseAt ? formatDate(inv.seatReleaseAt, locale) : null}
                      overdue={status === 'overdue'}
                      recipient={settings.name}
                      iban={settings.iban || null}
                      bic={settings.bic || null}
                      reference={formatReferenceNumber(inv.referenceNumber)}
                      barcode={
                        settings.iban
                          ? generateVirtualBarcode(settings.iban, remaining, inv.referenceNumber, inv.dueDate)
                          : null
                      }
                    />
                  )
                }
                return (
                  <p key={inv.id} className="font-medium">
                    {t('yourInvoice', { number: inv.invoiceNumber, amount: Number(inv.amount).toFixed(2) })}
                    {' · '}
                    {status === 'paid' ? t('invoicePaid') : t('invoiceBeingSent')}
                  </p>
                )
              })}
              <Link href="/members/invoices" className="block text-primary hover:underline">
                {t('overdueViewInvoices')}
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
