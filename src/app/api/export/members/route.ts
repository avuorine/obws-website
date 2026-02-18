import { requireAdmin } from '@/lib/admin-guard'
import { db } from '@/db'
import { user } from '@/db/schema'
import { sql } from 'drizzle-orm'
import { toCsv } from '@/lib/csv'
import { formatDate } from '@/lib/format-date'

export async function GET() {
  await requireAdmin()

  const members = await db
    .select()
    .from(user)
    .orderBy(sql`${user.memberNumber} ASC NULLS LAST`)

  const headers = [
    'Member Number',
    'First Name',
    'Last Name',
    'Email',
    'Phone',
    'Municipality',
    'Status',
    'Member Since',
  ]

  const rows = members.map((m) => [
    m.memberNumber != null ? String(m.memberNumber) : '',
    m.firstName ?? '',
    m.lastName ?? '',
    m.email,
    m.phone ?? '',
    m.municipality ?? '',
    m.status ?? '',
    formatDate(m.memberSince, 'fi'),
  ])

  const csv = toCsv(headers, rows)
  const date = new Date().toISOString().slice(0, 10)

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="members-${date}.csv"`,
    },
  })
}
