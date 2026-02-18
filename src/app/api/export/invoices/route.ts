import { requireAdmin } from '@/lib/admin-guard'
import { db } from '@/db'
import { invoices } from '@/db/schema'
import { desc } from 'drizzle-orm'
import { toCsv } from '@/lib/csv'
import { formatDate } from '@/lib/format-date'

export async function GET() {
  await requireAdmin()

  const allInvoices = await db
    .select()
    .from(invoices)
    .orderBy(desc(invoices.createdAt))

  const headers = [
    'Invoice Number',
    'Type',
    'Recipient Name',
    'Recipient Email',
    'Amount',
    'Reference Number',
    'Status',
    'Due Date',
    'Sent At',
    'Paid At',
  ]

  const rows = allInvoices.map((inv) => [
    String(inv.invoiceNumber),
    inv.type,
    inv.recipientName,
    inv.recipientEmail,
    inv.amount,
    inv.referenceNumber,
    inv.status,
    formatDate(inv.dueDate, 'fi'),
    formatDate(inv.sentAt, 'fi'),
    formatDate(inv.paidAt, 'fi'),
  ])

  const csv = toCsv(headers, rows)
  const date = new Date().toISOString().slice(0, 10)

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="invoices-${date}.csv"`,
    },
  })
}
