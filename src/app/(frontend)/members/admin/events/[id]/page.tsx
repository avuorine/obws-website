import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getTranslations, getLocale } from 'next-intl/server'
import { db } from '@/db'
import { events, eventCategories, eventRegistrations, user } from '@/db/schema'
import { eq, asc } from 'drizzle-orm'
import { formatDateTime } from '@/lib/format-date'
import { toDatetimeLocalString } from '@/lib/timezone'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EventForm } from '@/components/admin/EventForm'

import { StatusBadge } from '@/components/admin/StatusBadge'
import { EventStatusActions } from './status-actions'
import { ArrowLeft, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
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
    })
    .from(eventRegistrations)
    .innerJoin(user, eq(eventRegistrations.userId, user.id))
    .where(eq(eventRegistrations.eventId, id))
    .orderBy(asc(eventRegistrations.registeredAt))

  const statusLabel = (s: string) => {
    switch (s) {
      case 'draft': return t('draft')
      case 'published': return t('published')
      case 'completed': return t('completed')
      case 'cancelled': return t('cancelled')
      case 'registered': return t('active')
      case 'waitlisted': return 'Waitlisted'
      case 'pending': return 'Pending'
      default: return s
    }
  }

  return (
    <div className="space-y-6">
      <Link
        href="/members/admin/events"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('back')}
      </Link>

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

      {/* Status Actions */}
      <Card>
        <CardContent className="p-6">
          <EventStatusActions eventId={id} currentStatus={event.status ?? 'draft'} />
        </CardContent>
      </Card>

      {/* Registrations Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{t('registrations')}</CardTitle>
            {registrations.length > 0 && (
              <Button variant="outline" size="sm" asChild>
                <a href={`/api/export/events/${id}/registrations`}>
                  <Download className="mr-1 h-4 w-4" />
                  {t('export')}
                </a>
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {registrations.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('noRegistrations')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-input text-left">
                    <th className="px-4 py-3 font-medium">{t('name')}</th>
                    <th className="px-4 py-3 font-medium">{t('status')}</th>
                    <th className="px-4 py-3 font-medium">{t('guests')}</th>
                    <th className="px-4 py-3 font-medium">{t('registeredAt')}</th>
                  </tr>
                </thead>
                <tbody>
                  {registrations.map((reg) => (
                    <tr key={reg.id} className="border-b border-input last:border-0">
                      <td className="px-4 py-3">
                        {reg.firstName} {reg.lastName}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={reg.status} label={statusLabel(reg.status)} />
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {reg.guestCount > 0 ? reg.guestCount : '—'}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDateTime(reg.registeredAt, locale)}
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
