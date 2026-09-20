import { db } from '@/db'
import { events, eventRegistrations } from '@/db/schema'
import { eq, and, sql } from 'drizzle-orm'

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
 */
export async function cancelRegistrationRow(reg: Registration): Promise<void> {
  const wasRegistered = reg.status === 'registered' || reg.status === 'pending'
  const freedSeats = 1 + reg.guestCount

  await db.transaction(async (tx) => {
    await tx
      .update(eventRegistrations)
      .set({ status: 'cancelled', cancelledAt: new Date() })
      .where(eq(eventRegistrations.id, reg.id))

    if (wasRegistered) {
      await tx
        .update(events)
        .set({ registrationCount: sql`GREATEST(${events.registrationCount} - ${freedSeats}, 0)` })
        .where(eq(events.id, reg.eventId))

      await promoteWaitlisted(tx, reg.eventId, freedSeats)
    } else if (reg.status === 'waitlisted') {
      await tx
        .update(events)
        .set({ waitlistCount: sql`GREATEST(${events.waitlistCount} - ${freedSeats}, 0)` })
        .where(eq(events.id, reg.eventId))
    }
  })
}
