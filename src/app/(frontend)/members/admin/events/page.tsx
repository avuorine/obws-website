import Link from 'next/link'
import { getTranslations, getLocale } from 'next-intl/server'
import { db } from '@/db'
import { events, eventCategories, eventRegistrations } from '@/db/schema'
import { eq, asc, sql } from 'drizzle-orm'
import { getLocalized } from '@/lib/localize'
import { formatDateTime } from '@/lib/format-date'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { StatusBadge } from '@/components/admin/StatusBadge'

const STATUSES = ['all', 'draft', 'published', 'completed', 'cancelled'] as const

export default async function AdminEventsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { status: filterStatus } = await searchParams
  const t = await getTranslations('admin')
  const locale = await getLocale()

  const allEvents = await db
    .select({
      id: events.id,
      titleLocales: events.titleLocales,
      categoryId: events.categoryId,
      date: events.date,
      status: events.status,
      registrationCount: events.registrationCount,
    })
    .from(events)
    .orderBy(asc(events.date))

  const categoriesMap = new Map<string, { sv?: string; fi?: string; en?: string }>()
  const cats = await db.select().from(eventCategories)
  for (const c of cats) {
    categoriesMap.set(c.id, c.nameLocales)
  }

  // Count actual registrations per event
  const regCounts = await db
    .select({
      eventId: eventRegistrations.eventId,
      count: sql<number>`count(*)::int`,
    })
    .from(eventRegistrations)
    .where(eq(eventRegistrations.status, 'registered'))
    .groupBy(eventRegistrations.eventId)

  const regCountMap = new Map<string, number>()
  for (const r of regCounts) {
    regCountMap.set(r.eventId, r.count)
  }

  const filtered =
    filterStatus && filterStatus !== 'all'
      ? allEvents.filter((e) => e.status === filterStatus)
      : allEvents

  const statusLabel = (s: string) => {
    switch (s) {
      case 'draft': return t('draft')
      case 'published': return t('published')
      case 'completed': return t('completed')
      case 'cancelled': return t('cancelled')
      default: return s
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-serif text-3xl font-bold">{t('allEvents')}</h1>
        <Button asChild>
          <Link href="/members/admin/events/new">{t('addEvent')}</Link>
        </Button>
      </div>

      {/* Status filter tabs */}
      <div className="mb-4 flex flex-wrap gap-2">
        {STATUSES.map((s) => {
          const isActive = s === (filterStatus ?? 'all')
          return (
            <Link
              key={s}
              href={s === 'all' ? '/members/admin/events' : `/members/admin/events?status=${s}`}
              className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-accent'
              }`}
            >
              {s === 'all' ? t('all') : statusLabel(s)}
            </Link>
          )
        })}
      </div>

      {filtered.length === 0 ? (
        <p className="text-muted-foreground">{t('noEvents')}</p>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-input text-left">
                    <th className="px-4 py-3 font-medium">{t('status')}</th>
                    <th className="px-4 py-3 font-medium">{t('eventTitle')}</th>
                    <th className="px-4 py-3 font-medium">{t('eventCategory')}</th>
                    <th className="px-4 py-3 font-medium">{t('eventDate')}</th>
                    <th className="px-4 py-3 font-medium">{t('registrations')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((event) => (
                    <tr key={event.id} className="border-b border-input last:border-0">
                      <td className="px-4 py-3">
                        <StatusBadge
                          status={event.status ?? 'draft'}
                          label={statusLabel(event.status ?? 'draft')}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/members/admin/events/${event.id}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {getLocalized(event.titleLocales, locale)}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {event.categoryId
                          ? getLocalized(categoriesMap.get(event.categoryId) ?? null, locale)
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDateTime(event.date, locale)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {regCountMap.get(event.id) ?? 0}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
