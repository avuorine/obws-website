import { db } from '@/db'
import { eventRegistrations, invoices } from '@/db/schema'
import { and, eq } from 'drizzle-orm'
import { isOverdue, remainingAmount } from '@/lib/invoice-status'
import { paymentReminderDeadline } from '@/lib/event-due-date'

export interface OverdueBalance {
  count: number
  total: number
}

type InvoiceLike = Parameters<typeof isOverdue>[0] & {
  /**
   * Binding event invoices are due the day they are issued but have a few
   * banking days to be paid before the seat is released; until then they
   * do not count as overdue here.
   */
  paymentWindowEnd?: Date | null
}

/**
 * Sum what a member still owes on overdue invoices. Uses the same overdue
 * rule as the admin views (isOverdue), so partially paid invoices past their
 * due date count too. Returns null when nothing is overdue.
 */
export function summarizeOverdue(
  rows: InvoiceLike[],
  now: Date = new Date(),
): OverdueBalance | null {
  const overdue = rows.filter(
    (inv) => isOverdue(inv, now) && !(inv.paymentWindowEnd && now < inv.paymentWindowEnd),
  )
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
      type: invoices.type,
      dueDate: invoices.dueDate,
      seatReleaseAt: invoices.seatReleaseAt,
      amount: invoices.amount,
      paidAmount: invoices.paidAmount,
      autoInvoice: eventRegistrations.autoInvoice,
    })
    .from(invoices)
    .leftJoin(eventRegistrations, eq(eventRegistrations.id, invoices.eventRegistrationId))
    .where(and(eq(invoices.userId, userId), eq(invoices.status, 'sent')))

  return summarizeOverdue(
    rows.map((r) => ({
      ...r,
      paymentWindowEnd: r.type === 'event_fee' && r.autoInvoice ? paymentReminderDeadline(r) : null,
    })),
  )
}
