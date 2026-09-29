import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getTranslations, getLocale } from 'next-intl/server'
import { db } from '@/db'
import { events, eventCategories, eventRegistrations, user } from '@/db/schema'
import { eq, asc } from 'drizzle-orm'
import { getEventBillingSummary } from '@/lib/event-billing'
import { getEventPayments, PAYMENT_STATUS_KEY, type RegistrationPaymentStatus } from '@/lib/event-payments'
import { formatDateTime } from '@/lib/format-date'
import { toDatetimeLocalString } from '@/lib/timezone'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EventForm } from '@/components/admin/EventForm'

import { StatusBadge } from '@/components/admin/StatusBadge'
import { EventStatusActions } from './status-actions'
import { RegistrationActions } from './registration-actions'
import { EventAdminTools } from './admin-tools'
import { ArrowLeft, Download, Eye, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { requireAdmin } from '@/lib/admin-guard'

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const { id } = await params
  const t = await getTranslations('admin')
  const locale = await getLocale()

  const event = await db
    .select()
    .from(events)
    .where(eq(events.id, id))
    .then((r) => r[0])

  if (!event) notFound()

  const categories = await db
    .select()
    .from(eventCategories)
    .orderBy(eventCategories.sortOrder)

  const registrations = await db
    .select({
      id: eventRegistrations.id,
      status: eventRegistrations.status,
      guestCount: eventRegistrations.guestCount,
      registeredAt: eventRegistrations.registeredAt,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
    })
    .from(eventRegistrations)
    .innerJoin(user, eq(eventRegistrations.userId, user.id))
    .where(eq(eventRegistrations.eventId, id))
    .orderBy(asc(eventRegistrations.registeredAt))

  const pendingCount = registrations.filter((r) => r.status === 'pending').length
  const registeredCount = registrations.filter((r) => r.status === 'registered').length
  const waitlistedCount = registrations.filter((r) => r.status === 'waitlisted').length

  const hasPrice = event.price != null && Number(event.price) > 0
  const billing = hasPrice
    ? await getEventBillingSummary(id)
    : { registered: 0, fullyInvoiced: 0, needsInvoice: 0, overbilled: 0 }

  const payments = hasPrice ? await getEventPayments(id, registrations, Number(event.price)) : null

  const paymentVariant = (s: RegistrationPaymentStatus) => {
    switch (s) {
      case 'paid': return 'success' as const
      case 'partial': return 'warning' as const
      case 'overdue': return 'destructive' as const
      case 'sent': return 'outline' as const
      default: return 'default' as const
    }
  }

  const statusLabel = (s: string) => {
    switch (s) {
      case 'draft': return t('draft')
      case 'published': return t('published')
      case 'completed': return t('completed')
      case 'cancelled': return t('cancelled')
      case 'registered': return t('active')
      case 'waitlisted': return t('waitlisted')
      case 'pending': return t('pending')
      default: return s
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/members/admin/events"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('back')}
        </Link>
        <Link
          href={`/members/events/${id}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <Eye className="h-4 w-4" />
          {t('viewAsMember')}
        </Link>
      </div>

      {/* Event Form Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{t('editEvent')}</CardTitle>
            <StatusBadge status={event.status ?? 'draft'} label={statusLabel(event.status ?? 'draft')} />
          </div>
        </CardHeader>
        <CardContent>
          <EventForm
            eventId={id}
            categories={categories}
            defaultValues={{
              titleSv: event.titleLocales.sv ?? '',
              titleFi: event.titleLocales.fi ?? '',
              titleEn: event.titleLocales.en ?? '',
              summarySv: event.summaryLocales?.sv ?? '',
              summaryFi: event.summaryLocales?.fi ?? '',
              summaryEn: event.summaryLocales?.en ?? '',
              descriptionSv: event.descriptionLocales?.sv ?? '',
              descriptionFi: event.descriptionLocales?.fi ?? '',
              descriptionEn: event.descriptionLocales?.en ?? '',
              locationSv: event.locationLocales?.sv ?? '',
              locationFi: event.locationLocales?.fi ?? '',
              locationEn: event.locationLocales?.en ?? '',
              date: toDatetimeLocalString(event.date),
              endDate: toDatetimeLocalString(event.endDate),
              categoryId: event.categoryId ?? '',
              capacity: event.capacity != null ? String(event.capacity) : '',
              price: event.price ?? '',
              allocationMethod: event.allocationMethod ?? 'first_come',
              registrationOpensAt: toDatetimeLocalString(event.registrationOpensAt),
              registrationDeadline: toDatetimeLocalString(event.registrationDeadline),
              lotteryDate: toDatetimeLocalString(event.lotteryDate),
              cancellationAllowed: event.cancellationAllowed !== false ? 'on' : '',
              cancellationDeadline: toDatetimeLocalString(event.cancellationDeadline),
              guestAllowed: event.guestAllowed ? 'on' : '',
              maxGuestsPerMember: event.maxGuestsPerMember != null ? String(event.maxGuestsPerMember) : '1',
              guestRegistrationOpensAt: toDatetimeLocalString(event.guestRegistrationOpensAt),
            }}
          />
        </CardContent>
      </Card>

      {/* Event administration */}
      <Card>
        <CardHeader>
          <CardTitle>{t('eventAdministration')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <EventStatusActions eventId={id} currentStatus={event.status ?? 'draft'} />
          <EventAdminTools
            eventId={id}
            isLottery={event.allocationMethod === 'lottery'}
            lotteryCompleted={event.lotteryCompleted ?? false}
            pendingCount={pendingCount}
            registeredCount={registeredCount}
            waitlistedCount={waitlistedCount}
            hasPrice={hasPrice}
            fullyInvoiced={billing.fullyInvoiced}
            needsInvoice={billing.needsInvoice}
            overbilled={billing.overbilled}
          />
        </CardContent>
      </Card>

      {payments && (
        <Card>
          <CardHeader>
            <CardTitle>{t('payments')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {[
                { label: t('expectedRevenue'), amount: payments.stats.expected, tone: '' },
                { label: t('invoicedTotal'), amount: payments.stats.invoiced, tone: '' },
                { label: t('paid'), amount: payments.stats.paid, tone: 'text-[#4a6741]' },
                { label: t('outstandingTotal'), amount: payments.stats.outstanding, tone: '' },
                { label: t('overdue'), amount: payments.stats.overdue, tone: payments.stats.overdue > 0 ? 'text-[#a63d2a]' : '' },
              ].map((tile) => (
                <div key={tile.label} className="rounded-lg bg-muted p-3">
                  <p className="text-sm text-muted-foreground">{tile.label}</p>
                  <p className={`text-xl font-bold ${tile.tone}`}>€{tile.amount.toFixed(2)}</p>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 text-sm">
              {(Object.keys(PAYMENT_STATUS_KEY) as RegistrationPaymentStatus[])
                .filter((s) => payments.stats.counts[s] > 0)
                .map((s) => (
                  <Badge key={s} variant={paymentVariant(s)}>
                    {t(PAYMENT_STATUS_KEY[s])}: {payments.stats.counts[s]}
                  </Badge>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Registrations Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{t('registrations')}</CardTitle>
            {registrations.length > 0 && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" asChild>
                  <a href={`/api/export/events/${id}/participants`} target="_blank" rel="noopener">
                    <FileText className="mr-1 h-4 w-4" />
                    {t('participantsPdf')}
                  </a>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <a href={`/api/export/events/${id}/registrations`}>
                    <Download className="mr-1 h-4 w-4" />
                    {t('export')}
                  </a>
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {registrations.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('noRegistrations')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table w-full text-sm">
                <thead>
                  <tr className="border-b border-input text-left">
                    <th className="px-4 py-3 font-medium">{t('name')}</th>
                    <th className="px-4 py-3 font-medium">{t('status')}</th>
                    <th className="px-4 py-3 font-medium">{t('guests')}</th>
                    {payments && <th className="px-4 py-3 font-medium">{t('payment')}</th>}
                    <th className="px-4 py-3 font-medium">{t('registeredAt')}</th>
                    <th className="px-4 py-3 font-medium text-right">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {registrations.map((reg) => (
                    <tr
                      key={reg.id}
                      className={`border-b border-input last:border-0 ${reg.status === 'cancelled' ? 'text-muted-foreground line-through' : ''}`}
                    >
                      <td className="px-4 py-3">
                        {reg.firstName} {reg.lastName}
                        <span className="block text-xs text-muted-foreground">
                          {reg.email}
                          {reg.phone && <> · {reg.phone}</>}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={reg.status} label={statusLabel(reg.status)} />
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {reg.guestCount > 0 ? reg.guestCount : '—'}
                      </td>
                      {payments && (() => {
                        const pay = payments.byRegistration.get(reg.id)!
                        const badge = (
                          <Badge variant={paymentVariant(pay.status)}>{t(PAYMENT_STATUS_KEY[pay.status])}</Badge>
                        )
                        return (
                          <td className="px-4 py-3">
                            {pay.invoiceId ? (
                              <Link href={`/members/admin/invoices/${pay.invoiceId}`}>{badge}</Link>
                            ) : (
                              badge
                            )}
                            {pay.status !== 'not_invoiced' && (
                              <span className="block text-xs text-muted-foreground">
                                €{pay.paid.toFixed(2)} / €{pay.amount.toFixed(2)}
                              </span>
                            )}
                          </td>
                        )
                      })()}
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDateTime(reg.registeredAt, locale)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <RegistrationActions
                          registrationId={reg.id}
                          memberName={`${reg.firstName ?? ''} ${reg.lastName ?? ''}`.trim()}
                          status={reg.status}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
