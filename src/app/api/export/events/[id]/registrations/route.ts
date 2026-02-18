import { requireAdmin } from '@/lib/admin-guard'
import { db } from '@/db'
import { eventRegistrations, user } from '@/db/schema'
import { eq, asc } from 'drizzle-orm'
import { toCsv } from '@/lib/csv'
import { formatDate } from '@/lib/format-date'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireAdmin()
  const { id } = await params

  const registrations = await db
    .select({
      firstName: user.firstName,
      lastName: user.lastName,
      status: eventRegistrations.status,
      guestCount: eventRegistrations.guestCount,
      registeredAt: eventRegistrations.registeredAt,
    })
    .from(eventRegistrations)
    .innerJoin(user, eq(eventRegistrations.userId, user.id))
    .where(eq(eventRegistrations.eventId, id))
    .orderBy(asc(eventRegistrations.registeredAt))

  const headers = ['Name', 'Status', 'Guest Count', 'Registered At']

  const rows = registrations.map((r) => [
    `${r.firstName ?? ''} ${r.lastName ?? ''}`.trim(),
    r.status,
    String(r.guestCount),
    formatDate(r.registeredAt, 'fi'),
  ])

  const csv = toCsv(headers, rows)
  const date = new Date().toISOString().slice(0, 10)

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="registrations-${id}-${date}.csv"`,
    },
  })
}
