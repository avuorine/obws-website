import { db } from '@/db'
import { events, eventRegistrations } from '@/db/schema'
import { eq, and, ne, sql } from 'drizzle-orm'

type Registration = typeof eventRegistrations.$inferSelect
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

/**
 * Promote waitlisted registrations (oldest first) into `freedSeats` seats.
 * A waitlisted registration needs 1 + guestCount seats and is skipped once
 * it no longer fits, mirroring the original member-side cancel behaviour.
 */
async function promoteWaitlisted(tx: Tx, eventId: string, freedSeats: number): Promise<void> {
  let remainingSeats = freedSeats
  const waitlisted = await tx
    .select()
    .from(eventRegistrations)
    .where(
      and(eq(eventRegistrations.eventId, eventId), eq(eventRegistrations.status, 'waitlisted')),
    )
    .orderBy(eventRegistrations.registeredAt)

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

    remainingSeats -= seatsNeeded
    if (remainingSeats <= 0) break
  }
}

/**
 * Cancel a registration, release its seats from the event counters and
 * promote waitlisted members into any freed seats. Shared by the member-side
 * self-cancel and the admin removal so both stay in sync.
 *
 * The status flip is conditional on the row not already being cancelled, so
 * two concurrent requests (a double-click, two admins) cannot both release
 * the seats: the second sees no row and returns false without touching the
 * counters. Pass `tx` to run inside a caller's transaction so related
 * writes (e.g. invoice cancellation) commit or roll back together.
 */
export async function cancelRegistrationRow(reg: Registration, tx?: Tx): Promise<boolean> {
  const run = async (t: Tx): Promise<boolean> => {
    const [row] = await t
      .update(eventRegistrations)
      .set({ status: 'cancelled', cancelledAt: new Date() })
      .where(and(eq(eventRegistrations.id, reg.id), ne(eventRegistrations.status, 'cancelled')))
      .returning({ id: eventRegistrations.id })

    if (!row) return false

    const wasRegistered = reg.status === 'registered' || reg.status === 'pending'
    const freedSeats = 1 + reg.guestCount

    if (wasRegistered) {
      await t
        .update(events)
        .set({ registrationCount: sql`GREATEST(${events.registrationCount} - ${freedSeats}, 0)` })
        .where(eq(events.id, reg.eventId))

      await promoteWaitlisted(t, reg.eventId, freedSeats)
    } else if (reg.status === 'waitlisted') {
      await t
        .update(events)
        .set({ waitlistCount: sql`GREATEST(${events.waitlistCount} - ${freedSeats}, 0)` })
        .where(eq(events.id, reg.eventId))
    }
    return true
  }

  return tx ? run(tx) : db.transaction(run)
}
