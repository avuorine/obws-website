import { db } from '@/db'
import { events, eventRegistrations } from '@/db/schema'
import { eq, and, ne, sql } from 'drizzle-orm'
import { issueEventInvoice } from './event-invoicing'

type Registration = typeof eventRegistrations.$inferSelect
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

/**
 * Promote waitlisted registrations (oldest first) into `freedSeats` seats.
 * A waitlisted registration needs 1 + guestCount seats and is skipped once
 * it no longer fits, mirroring the original member-side cancel behaviour.
 *
 * A promoted binding signup is invoiced for all its seats in the same
 * transaction. Returns the new draft invoice ids; deliver them after commit.
 */
export async function promoteWaitlisted(tx: Tx, eventId: string, freedSeats: number): Promise<string[]> {
  const invoiceIds: string[] = []
  let remainingSeats = freedSeats
  if (remainingSeats <= 0) return invoiceIds

  const waitlisted = await tx
    .select()
    .from(eventRegistrations)
    .where(
      and(eq(eventRegistrations.eventId, eventId), eq(eventRegistrations.status, 'waitlisted')),
    )
    .orderBy(eventRegistrations.registeredAt)

  const event = waitlisted.some((r) => r.autoInvoice)
    ? await tx.select().from(events).where(eq(events.id, eventId)).then((r) => r[0])
    : undefined

  for (const next of waitlisted) {
    const seatsNeeded = 1 + next.guestCount
    if (seatsNeeded > remainingSeats) break

    await tx
      .update(eventRegistrations)
      .set({ status: 'registered' })
      .where(eq(eventRegistrations.id, next.id))

    await tx
      .update(events)
      .set({
        registrationCount: sql`${events.registrationCount} + ${seatsNeeded}`,
        waitlistCount: sql`GREATEST(${events.waitlistCount} - ${seatsNeeded}, 0)`,
      })
      .where(eq(events.id, eventId))

    if (next.autoInvoice && event) {
      const id = await issueEventInvoice(tx, {
        event,
        registrationId: next.id,
        userId: next.userId,
        seats: seatsNeeded,
        supplementary: false,
      })
      if (id) invoiceIds.push(id)
    }

    remainingSeats -= seatsNeeded
    if (remainingSeats <= 0) break
  }
  return invoiceIds
}

export interface CancelResult {
  cancelled: boolean
  /** Draft invoices for members promoted from the waitlist; deliver after commit. */
  issuedInvoiceIds: string[]
}

/**
 * Cancel a registration, release its seats from the event counters and
 * promote waitlisted members into any freed seats. Shared by the member-side
 * self-cancel, the admin removal and the unpaid-seat release so all stay in
 * sync.
 *
 * The status flip is conditional on the row not already being cancelled, so
 * two concurrent requests (a double-click, two admins) cannot both release
 * the seats: the second sees no row and returns cancelled: false without
 * touching the counters. Pass `tx` to run inside a caller's transaction so
 * related writes (e.g. invoice cancellation) commit or roll back together.
 */
export async function cancelRegistrationRow(reg: Registration, tx?: Tx): Promise<CancelResult> {
  const run = async (t: Tx): Promise<CancelResult> => {
    const [row] = await t
      .update(eventRegistrations)
      .set({ status: 'cancelled', cancelledAt: new Date() })
      .where(and(eq(eventRegistrations.id, reg.id), ne(eventRegistrations.status, 'cancelled')))
      .returning({ id: eventRegistrations.id })

    if (!row) return { cancelled: false, issuedInvoiceIds: [] }

    const wasRegistered = reg.status === 'registered' || reg.status === 'pending'
    const freedSeats = 1 + reg.guestCount
    let issuedInvoiceIds: string[] = []

    if (wasRegistered) {
      await t
        .update(events)
        .set({ registrationCount: sql`GREATEST(${events.registrationCount} - ${freedSeats}, 0)` })
        .where(eq(events.id, reg.eventId))

      issuedInvoiceIds = await promoteWaitlisted(t, reg.eventId, freedSeats)
    } else if (reg.status === 'waitlisted') {
      await t
        .update(events)
        .set({ waitlistCount: sql`GREATEST(${events.waitlistCount} - ${freedSeats}, 0)` })
        .where(eq(events.id, reg.eventId))
    }
    return { cancelled: true, issuedInvoiceIds }
  }

  return tx ? run(tx) : db.transaction(run)
}
