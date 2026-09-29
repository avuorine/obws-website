import { getLocale, getTranslations } from 'next-intl/server'
import { requireAdmin } from '@/lib/admin-guard'
import { db } from '@/db'
import { events, eventRegistrations, user } from '@/db/schema'
import { eq, asc } from 'drizzle-orm'
import { getLocalized } from '@/lib/localize'
import { formatDateTime } from '@/lib/format-date'
import { getSettings } from '@/lib/settings'
import { getEventPayments, PAYMENT_STATUS_KEY } from '@/lib/event-payments'
import { generateParticipantsPdf, type ParticipantRow } from '@/lib/participants-pdf'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireAdmin()
  const { id } = await params
  const locale = await getLocale()
  const t = await getTranslations('admin')

  const event = await db.select().from(events).where(eq(events.id, id)).then((r) => r[0])
  if (!event) return new Response('Event not found', { status: 404 })

  const registrations = await db
    .select({
      id: eventRegistrations.id,
      status: eventRegistrations.status,
      guestCount: eventRegistrations.guestCount,
      firstName: user.firstName,
      lastName: user.lastName,
      userName: user.name,
      email: user.email,
      phone: user.phone,
    })
    .from(eventRegistrations)
    .innerJoin(user, eq(eventRegistrations.userId, user.id))
    .where(eq(eventRegistrations.eventId, id))
    .orderBy(asc(eventRegistrations.registeredAt))

  const price = Number(event.price ?? 0)
  const hasPrice = price > 0
  const payments = hasPrice ? await getEventPayments(id, registrations, price) : null
  const eur = (n: number) => `€${n.toFixed(2)}`

  const toRow = (reg: (typeof registrations)[number]): ParticipantRow => {
    const pay = payments?.byRegistration.get(reg.id)
    return {
      name: `${reg.firstName ?? ''} ${reg.lastName ?? ''}`.trim() || reg.userName,
      email: reg.email,
      phone: reg.phone ?? '',
      guestCount: reg.guestCount,
      paymentLabel: pay ? t(PAYMENT_STATUS_KEY[pay.status]) : null,
      paymentAmount: pay && pay.status !== 'not_invoiced' ? `${eur(pay.paid)} / ${eur(pay.amount)}` : null,
    }
  }
  const byStatus = (status: string) => registrations.filter((r) => r.status === status).map(toRow)

  const registered = registrations.filter((r) => r.status === 'registered')
  const seats = registered.reduce((sum, r) => sum + 1 + r.guestCount, 0)

  const summary = [
    { label: t('participants'), value: `${registered.length} (${t('seatsCount', { count: seats })})` },
    ...(event.capacity ? [{ label: t('capacity'), value: String(event.capacity) }] : []),
    ...(payments
      ? [
          { label: t('expectedRevenue'), value: eur(payments.stats.expected) },
          { label: t('paid'), value: eur(payments.stats.paid) },
          { label: t('outstandingTotal'), value: eur(payments.stats.outstanding) },
          { label: t('overdue'), value: eur(payments.stats.overdue) },
        ]
      : []),
  ]

  const settings = await getSettings()
  const pdf = await generateParticipantsPdf({
    societyName: settings.name ?? '',
    eventTitle: getLocalized(event.titleLocales, locale),
    eventMeta: [
      formatDateTime(event.date, locale),
      ...(event.locationLocales ? [getLocalized(event.locationLocales, locale)] : []),
    ].filter(Boolean),
    summary,
    showPayment: hasPrice,
    sections: [
      { title: t('participants'), rows: byStatus('registered') },
      { title: t('waitlisted'), rows: byStatus('waitlisted') },
      { title: t('pending'), rows: byStatus('pending') },
    ],
    labels: {
      name: t('name'),
      email: t('email'),
      phone: t('phone'),
      guests: t('guests'),
      payment: t('payment'),
      amount: t('paidOfAmount'),
      present: t('present'),
      generated: `${t('generatedAt')} ${formatDateTime(new Date(), locale)}`,
      page: t('page'),
    },
  })

  const date = new Date().toISOString().slice(0, 10)
  return new Response(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="participants-${id}-${date}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
