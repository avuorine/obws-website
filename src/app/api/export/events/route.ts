import { requireAdmin } from '@/lib/admin-guard'
import { db } from '@/db'
import { events } from '@/db/schema'
import { asc } from 'drizzle-orm'
import { toCsv } from '@/lib/csv'
import { formatDate } from '@/lib/format-date'

export async function GET() {
  await requireAdmin()

  const allEvents = await db
    .select()
    .from(events)
    .orderBy(asc(events.date))

  const headers = [
    'Title (SV)',
    'Date',
    'Capacity',
    'Registration Count',
    'Status',
  ]

  const rows = allEvents.map((e) => [
    e.titleLocales.sv ?? '',
    formatDate(e.date, 'fi'),
    e.capacity != null ? String(e.capacity) : '',
    String(e.registrationCount ?? 0),
    e.status ?? 'draft',
  ])

  const csv = toCsv(headers, rows)
  const date = new Date().toISOString().slice(0, 10)

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="events-${date}.csv"`,
    },
  })
}
