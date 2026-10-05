'use server'

import { revalidatePath } from 'next/cache'
import { getLocale } from 'next-intl/server'
import { getMember } from '@/lib/auth-server'
import { cancelRegistrationRow, promoteWaitlisted } from '@/lib/registrations'
import { getOverdueBalance } from '@/lib/overdue-balance'
import { isRegistrationClosed, memberCancelBlockReason } from '@/lib/event-deadlines'
import { sendRegistrationConfirmation } from '@/lib/registration-email'
import { deliverInvoices, issueEventInvoice } from '@/lib/event-invoicing'
import { db } from '@/db'
import { events, eventRegistrations } from '@/db/schema'
import { eq, and, ne, sql } from 'drizzle-orm'

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]
type Result = { success: boolean; error?: string }

/**
 * The event row, locked for the rest of the transaction so concurrent
 * signups for the same event are serialised: capacity checks and counter
 * updates can't interleave, and the last seat can't be given out twice.
 */
function lockEvent(tx: Tx, eventId: string) {
  return tx
    .select()
    .from(events)
    .where(eq(events.id, eventId))
    .for('update')
    .then((r) => r[0])
}

function liveRegistration(tx: Tx, eventId: string, userId: string) {
  return tx
    .select()
    .from(eventRegistrations)
    .where(
      and(
        eq(eventRegistrations.eventId, eventId),
        eq(eventRegistrations.userId, userId),
        ne(eventRegistrations.status, 'cancelled'),
      ),
    )
    .then((r) => r[0])
}

function revalidateEvent(eventId: string) {
  revalidatePath(`/members/events/${eventId}`)
  revalidatePath('/members/events')
  revalidatePath('/members/invoices')
}

export async function registerForEvent(eventId: string, acceptedTerms: boolean): Promise<Result> {
  const member = await getMember()
  if (!member) return { success: false, error: 'Not authenticated' }
  // The member must have seen and accepted the binding terms dialog.
  if (acceptedTerms !== true) return { success: false, error: 'termsNotAccepted' }

  // Members with overdue invoices can't book until the balance is cleared
  if (await getOverdueBalance(member.id)) return { success: false, error: 'overdueInvoices' }

  const result = await db.transaction(async (tx) => {
    const event = await lockEvent(tx, eventId)
    if (!event || event.status !== 'published') return { error: 'Event not found' }

    if (event.registrationOpensAt && new Date() < event.registrationOpensAt) {
      return { error: 'Registration not open yet' }
    }
    if (isRegistrationClosed(event)) return { error: 'registrationClosed' }
    if (await liveRegistration(tx, eventId, member.id)) return { error: 'Already registered' }

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

    const [reg] = await tx
      .insert(eventRegistrations)
      .values({ eventId, userId: member.id, status, autoInvoice: true })
      .returning({ id: eventRegistrations.id })

    if (status === 'registered' || status === 'pending') {
      await tx
        .update(events)
        .set({ registrationCount: sql`${events.registrationCount} + 1` })
        .where(eq(events.id, eventId))
    } else {
      await tx
        .update(events)
        .set({ waitlistCount: sql`${events.waitlistCount} + 1` })
        .where(eq(events.id, eventId))
    }

    // A seat is invoiced as soon as it is allocated; waitlist and lottery
    // entries are invoiced on promotion or at the draw.
    const invoiceId =
      status === 'registered'
        ? await issueEventInvoice(tx, { event, registrationId: reg.id, userId: member.id, seats: 1, supplementary: false })
        : null

    return { event, status, invoiceId }
  })

  if ('error' in result) return { success: false, error: result.error }

  await sendRegistrationConfirmation({
    to: member.email,
    firstName: member.firstName ?? member.name,
    locale: await getLocale(),
    event: result.event,
    status: result.status,
    seats: 1,
    binding: true,
  })
  await deliverInvoices([result.invoiceId], { reason: 'signup' })

  revalidateEvent(eventId)
  return { success: true }
}

export async function addGuest(eventId: string, acceptedTerms: boolean): Promise<Result> {
  const member = await getMember()
  if (!member) return { success: false, error: 'Not authenticated' }
  if (acceptedTerms !== true) return { success: false, error: 'termsNotAccepted' }

  // Members with overdue invoices can't book until the balance is cleared
  if (await getOverdueBalance(member.id)) return { success: false, error: 'overdueInvoices' }

  const result = await db.transaction(async (tx) => {
    const event = await lockEvent(tx, eventId)
    if (!event || event.status !== 'published') return { error: 'Event not found' }
    if (!event.guestAllowed) return { error: 'Guests not allowed' }

    if (event.guestRegistrationOpensAt && new Date() < event.guestRegistrationOpensAt) {
      return { error: 'Guest registration not open yet' }
    }
    if (isRegistrationClosed(event)) return { error: 'registrationClosed' }
    if (event.allocationMethod === 'lottery' && !event.lotteryCompleted) {
      return { error: 'Guests allowed after lottery' }
    }

    const reg = await liveRegistration(tx, eventId, member.id)
    if (!reg) return { error: 'Must register first' }
    if (reg.guestCount >= event.maxGuestsPerMember) return { error: 'Guest limit reached' }

    if (reg.status === 'registered' && event.capacity && (event.registrationCount ?? 0) >= event.capacity) {
      return { error: 'Event full' }
    }

    await tx
      .update(eventRegistrations)
      .set({ guestCount: sql`${eventRegistrations.guestCount} + 1` })
      .where(eq(eventRegistrations.id, reg.id))

    if (reg.status === 'registered') {
      await tx
        .update(events)
        .set({ registrationCount: sql`${events.registrationCount} + 1` })
        .where(eq(events.id, eventId))
    } else if (reg.status === 'waitlisted') {
      await tx
        .update(events)
        .set({ waitlistCount: sql`${events.waitlistCount} + 1` })
        .where(eq(events.id, eventId))
    }

    // A binding signup's guest seat is invoiced right away on its own
    // invoice; a waitlisted member's guests are invoiced on promotion.
    const invoiceId =
      reg.autoInvoice && reg.status === 'registered'
        ? await issueEventInvoice(tx, { event, registrationId: reg.id, userId: member.id, seats: 1, supplementary: true })
        : null

    return { event, reg, invoiceId }
  })

  if ('error' in result) return { success: false, error: result.error }

  await sendRegistrationConfirmation({
    to: member.email,
    firstName: member.firstName ?? member.name,
    locale: await getLocale(),
    event: result.event,
    status: result.reg.status as 'registered' | 'waitlisted',
    seats: result.reg.guestCount + 2,
    guestAdded: true,
    binding: result.reg.autoInvoice,
  })
  await deliverInvoices([result.invoiceId], { reason: 'guest' })

  revalidateEvent(eventId)
  return { success: true }
}

export async function removeGuest(eventId: string): Promise<Result> {
  const member = await getMember()
  if (!member) return { success: false, error: 'Not authenticated' }

  const result = await db.transaction(async (tx) => {
    const event = await lockEvent(tx, eventId)
    if (!event) return { error: 'Event not found' }

    const reg = await liveRegistration(tx, eventId, member.id)
    if (!reg) return { error: 'No registration found' }

    const blockReason = memberCancelBlockReason(event, reg)
    if (blockReason) return { error: blockReason }
    if (reg.guestCount <= 0) return { error: 'No guests to remove' }

    await tx
      .update(eventRegistrations)
      .set({ guestCount: sql`${eventRegistrations.guestCount} - 1` })
      .where(eq(eventRegistrations.id, reg.id))

    let issuedInvoiceIds: string[] = []
    if (reg.status === 'registered') {
      const [updated] = await tx
        .update(events)
        .set({ registrationCount: sql`GREATEST(${events.registrationCount} - 1, 0)` })
        .where(eq(events.id, eventId))
        .returning({ capacity: events.capacity, registrationCount: events.registrationCount })

      // Promote from the waitlist into whatever is free now.
      if (updated.capacity) {
        issuedInvoiceIds = await promoteWaitlisted(tx, eventId, updated.capacity - (updated.registrationCount ?? 0))
      }
    } else if (reg.status === 'waitlisted') {
      await tx
        .update(events)
        .set({ waitlistCount: sql`GREATEST(${events.waitlistCount} - 1, 0)` })
        .where(eq(events.id, eventId))
    }
    return { issuedInvoiceIds }
  })

  if ('error' in result) return { success: false, error: result.error }
  await deliverInvoices(result.issuedInvoiceIds, { reason: 'promoted' })

  revalidateEvent(eventId)
  return { success: true }
}

export async function cancelRegistration(eventId: string): Promise<Result> {
  const member = await getMember()
  if (!member) return { success: false, error: 'Not authenticated' }

  // Read and cancel under the event lock, so a promotion from the waitlist
  // in between can't turn a withdrawal into cancelling a binding seat.
  const result = await db.transaction(async (tx) => {
    const event = await lockEvent(tx, eventId)
    if (!event) return { error: 'Event not found' }

    const reg = await liveRegistration(tx, eventId, member.id)
    if (!reg) return { error: 'No registration found' }

    const blockReason = memberCancelBlockReason(event, reg)
    if (blockReason) return { error: blockReason }

    const { cancelled, issuedInvoiceIds } = await cancelRegistrationRow(reg, tx)
    if (!cancelled) return { error: 'No registration found' }
    return { issuedInvoiceIds }
  })

  if ('error' in result) return { success: false, error: result.error }
  await deliverInvoices(result.issuedInvoiceIds, { reason: 'promoted' })

  revalidateEvent(eventId)
  return { success: true }
}
