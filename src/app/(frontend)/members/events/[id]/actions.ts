'use server'

import { revalidatePath } from 'next/cache'
import { getMember } from '@/lib/auth-server'
import { db } from '@/db'
import { events, eventRegistrations } from '@/db/schema'
import { eq, and, sql } from 'drizzle-orm'

export async function registerForEvent(
  eventId: string,
): Promise<{ success: boolean; error?: string }> {
  const member = await getMember()
  if (!member) return { success: false, error: 'Not authenticated' }

  const event = await db.select().from(events).where(eq(events.id, eventId)).then((r) => r[0])
  if (!event) return { success: false, error: 'Event not found' }

  if (event.registrationOpensAt && new Date() < event.registrationOpensAt) {
    return { success: false, error: 'Registration not open yet' }
  }

  if (event.registrationDeadline && new Date() > event.registrationDeadline) {
    return { success: false, error: 'Registration closed' }
  }

  // Check for existing non-cancelled registration
  const existing = await db
    .select()
    .from(eventRegistrations)
    .where(
      and(
        eq(eventRegistrations.eventId, eventId),
        eq(eventRegistrations.userId, member.id),
      ),
    )
    .then((r) => r.find((reg) => reg.status !== 'cancelled'))

  if (existing) return { success: false, error: 'Already registered' }

  const isLottery = event.allocationMethod === 'lottery'
  const isFull = event.capacity ? (event.registrationCount ?? 0) >= event.capacity : false

  let status: 'registered' | 'waitlisted' | 'pending'
  if (isLottery && !event.lotteryCompleted) {
    status = 'pending'
  } else if (isFull) {
    status = 'waitlisted'
  } else {
    status = 'registered'
  }

  await db.insert(eventRegistrations).values({
    eventId,
    userId: member.id,
    status,
  })

  // Update counts
  if (status === 'registered' || status === 'pending') {
    await db
      .update(events)
      .set({ registrationCount: sql`${events.registrationCount} + 1` })
      .where(eq(events.id, eventId))
  } else if (status === 'waitlisted') {
    await db
      .update(events)
      .set({ waitlistCount: sql`${events.waitlistCount} + 1` })
      .where(eq(events.id, eventId))
  }

  revalidatePath(`/members/events/${eventId}`)
  revalidatePath('/members/events')
  return { success: true }
}

export async function addGuest(
  eventId: string,
): Promise<{ success: boolean; error?: string }> {
  const member = await getMember()
  if (!member) return { success: false, error: 'Not authenticated' }

  const event = await db.select().from(events).where(eq(events.id, eventId)).then((r) => r[0])
  if (!event) return { success: false, error: 'Event not found' }
  if (!event.guestAllowed) return { success: false, error: 'Guests not allowed' }

  if (event.guestRegistrationOpensAt && new Date() < event.guestRegistrationOpensAt) {
    return { success: false, error: 'Guest registration not open yet' }
  }

  if (event.registrationDeadline && new Date() > event.registrationDeadline) {
    return { success: false, error: 'Registration closed' }
  }

  if (event.allocationMethod === 'lottery' && !event.lotteryCompleted) {
    return { success: false, error: 'Guests allowed after lottery' }
  }

  const reg = await db
    .select()
    .from(eventRegistrations)
    .where(
      and(
        eq(eventRegistrations.eventId, eventId),
        eq(eventRegistrations.userId, member.id),
      ),
    )
    .then((r) => r.find((r) => r.status !== 'cancelled'))

  if (!reg) return { success: false, error: 'Must register first' }
  if (reg.guestCount >= event.maxGuestsPerMember) return { success: false, error: 'Guest limit reached' }

  if (reg.status === 'registered' && event.capacity && (event.registrationCount ?? 0) >= event.capacity) {
    return { success: false, error: 'Event full' }
  }

  await db
    .update(eventRegistrations)
    .set({ guestCount: sql`${eventRegistrations.guestCount} + 1` })
    .where(eq(eventRegistrations.id, reg.id))

  if (reg.status === 'registered') {
    await db
      .update(events)
      .set({ registrationCount: sql`${events.registrationCount} + 1` })
      .where(eq(events.id, eventId))
  } else if (reg.status === 'waitlisted') {
    await db
      .update(events)
      .set({ waitlistCount: sql`${events.waitlistCount} + 1` })
      .where(eq(events.id, eventId))
  }

  revalidatePath(`/members/events/${eventId}`)
  revalidatePath('/members/events')
  return { success: true }
}

export async function removeGuest(
  eventId: string,
): Promise<{ success: boolean; error?: string }> {
  const member = await getMember()
  if (!member) return { success: false, error: 'Not authenticated' }

  const reg = await db
    .select()
    .from(eventRegistrations)
    .where(
      and(
        eq(eventRegistrations.eventId, eventId),
        eq(eventRegistrations.userId, member.id),
      ),
    )
    .then((r) => r.find((r) => r.status !== 'cancelled'))

  if (!reg) return { success: false, error: 'No registration found' }
  if (reg.guestCount <= 0) return { success: false, error: 'No guests to remove' }

  await db
    .update(eventRegistrations)
    .set({ guestCount: sql`${eventRegistrations.guestCount} - 1` })
    .where(eq(eventRegistrations.id, reg.id))

  if (reg.status === 'registered') {
    await db
      .update(events)
      .set({ registrationCount: sql`GREATEST(${events.registrationCount} - 1, 0)` })
      .where(eq(events.id, eventId))

    // Promote from waitlist if a seat freed up
    const event = await db.select().from(events).where(eq(events.id, eventId)).then((r) => r[0])
    if (event && event.capacity && (event.registrationCount ?? 0) < event.capacity) {
      const nextWaitlisted = await db
        .select()
        .from(eventRegistrations)
        .where(
          and(
            eq(eventRegistrations.eventId, eventId),
            eq(eventRegistrations.status, 'waitlisted'),
          ),
        )
        .orderBy(eventRegistrations.registeredAt)
        .limit(1)
        .then((r) => r[0])

      if (nextWaitlisted) {
        const seatsNeeded = 1 + nextWaitlisted.guestCount
        const seatsAvailable = event.capacity - (event.registrationCount ?? 0)
        if (seatsNeeded <= seatsAvailable) {
          await db
            .update(eventRegistrations)
            .set({ status: 'registered' })
            .where(eq(eventRegistrations.id, nextWaitlisted.id))

          await db
            .update(events)
            .set({
              registrationCount: sql`${events.registrationCount} + ${seatsNeeded}`,
              waitlistCount: sql`GREATEST(${events.waitlistCount} - ${seatsNeeded}, 0)`,
            })
            .where(eq(events.id, eventId))
        }
      }
    }
  } else if (reg.status === 'waitlisted') {
    await db
      .update(events)
      .set({ waitlistCount: sql`GREATEST(${events.waitlistCount} - 1, 0)` })
      .where(eq(events.id, eventId))
  }

  revalidatePath(`/members/events/${eventId}`)
  revalidatePath('/members/events')
  return { success: true }
}

export async function cancelRegistration(
  eventId: string,
): Promise<{ success: boolean; error?: string }> {
  const member = await getMember()
  if (!member) return { success: false, error: 'Not authenticated' }

  const reg = await db
    .select()
    .from(eventRegistrations)
    .where(
      and(
        eq(eventRegistrations.eventId, eventId),
        eq(eventRegistrations.userId, member.id),
      ),
    )
    .then((r) => r.find((reg) => reg.status !== 'cancelled'))

  if (!reg) return { success: false, error: 'No registration found' }

  const wasRegistered = reg.status === 'registered' || reg.status === 'pending'
  const freedSeats = 1 + reg.guestCount

  await db
    .update(eventRegistrations)
    .set({ status: 'cancelled', cancelledAt: new Date() })
    .where(eq(eventRegistrations.id, reg.id))

  // Update counts
  if (wasRegistered) {
    await db
      .update(events)
      .set({ registrationCount: sql`GREATEST(${events.registrationCount} - ${freedSeats}, 0)` })
      .where(eq(events.id, eventId))

    // Promote waitlisted registrations into freed seats
    let remainingSeats = freedSeats
    const waitlisted = await db
      .select()
      .from(eventRegistrations)
      .where(
        and(
          eq(eventRegistrations.eventId, eventId),
          eq(eventRegistrations.status, 'waitlisted'),
        ),
      )
      .orderBy(eventRegistrations.registeredAt)

    for (const next of waitlisted) {
      const seatsNeeded = 1 + next.guestCount
      if (seatsNeeded > remainingSeats) break
      await db
        .update(eventRegistrations)
        .set({ status: 'registered' })
        .where(eq(eventRegistrations.id, next.id))

      await db
        .update(events)
        .set({
          registrationCount: sql`${events.registrationCount} + ${seatsNeeded}`,
          waitlistCount: sql`GREATEST(${events.waitlistCount} - ${seatsNeeded}, 0)`,
        })
        .where(eq(events.id, eventId))

      remainingSeats -= seatsNeeded
      if (remainingSeats <= 0) break
    }
  } else if (reg.status === 'waitlisted') {
    await db
      .update(events)
      .set({ waitlistCount: sql`GREATEST(${events.waitlistCount} - ${freedSeats}, 0)` })
      .where(eq(events.id, eventId))
  }

  revalidatePath(`/members/events/${eventId}`)
  revalidatePath('/members/events')
  return { success: true }
}

export async function runLottery(
  eventId: string,
): Promise<{ success: boolean; error?: string }> {
  const member = await getMember()
  if (!member || member.role !== 'admin') {
    return { success: false, error: 'Not authorized' }
  }

  const event = await db.select().from(events).where(eq(events.id, eventId)).then((r) => r[0])
  if (!event) return { success: false, error: 'Event not found' }
  if (event.lotteryCompleted) return { success: false, error: 'Lottery already completed' }
  if (event.allocationMethod !== 'lottery') return { success: false, error: 'Not a lottery event' }

  // Get all pending registrations
  const pending = await db
    .select()
    .from(eventRegistrations)
    .where(
      and(
        eq(eventRegistrations.eventId, eventId),
        eq(eventRegistrations.status, 'pending'),
      ),
    )

  // Fisher-Yates shuffle
  const shuffled = [...pending]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }

  const capacity = event.capacity ?? shuffled.length
  let registeredCount = 0
  let waitlistCount = 0

  for (let i = 0; i < shuffled.length; i++) {
    const status = i < capacity ? 'registered' : 'waitlisted'
    await db
      .update(eventRegistrations)
      .set({ status })
      .where(eq(eventRegistrations.id, shuffled[i].id))

    if (status === 'registered') registeredCount++
    else waitlistCount++
  }

  await db
    .update(events)
    .set({
      lotteryCompleted: true,
      registrationCount: registeredCount,
      waitlistCount,
    })
    .where(eq(events.id, eventId))

  revalidatePath(`/members/events/${eventId}`)
  revalidatePath('/members/events')
  return { success: true }
}
