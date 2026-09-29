import { db } from '@/db'
import { invoices } from '@/db/schema'
import { and, eq } from 'drizzle-orm'
import { isOverdue, remainingAmount } from '@/lib/invoice-status'

export interface OverdueBalance {
  count: number
  total: number
}

type InvoiceLike = Parameters<typeof isOverdue>[0]

/**
 * Sum what a member still owes on overdue invoices. Uses the same overdue
 * rule as the admin views (isOverdue), so partially paid invoices past their
 * due date count too. Returns null when nothing is overdue.
 */
export function summarizeOverdue(
  rows: InvoiceLike[],
  now: Date = new Date(),
): OverdueBalance | null {
  const overdue = rows.filter((inv) => isOverdue(inv, now))
  if (overdue.length === 0) return null
  return {
    count: overdue.length,
    total: overdue.reduce((sum, inv) => sum + remainingAmount(inv), 0),
  }
}

/** Overdue balance for a member; members with one cannot book events. */
export async function getOverdueBalance(userId: string): Promise<OverdueBalance | null> {
  const rows = await db
    .select({
      status: invoices.status,
      dueDate: invoices.dueDate,
      amount: invoices.amount,
      paidAmount: invoices.paidAmount,
    })
    .from(invoices)
    .where(and(eq(invoices.userId, userId), eq(invoices.status, 'sent')))

  return summarizeOverdue(rows)
}
