'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/admin-guard'
import { db } from '@/db'
import { events, eventRegistrations, invoices, user } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { cancelRegistrationRow } from '@/lib/registrations'
import { eventFeeDescription } from '@/lib/event-billing'
import { eventInvoiceDueDate } from '@/lib/event-due-date'
import { getNextInvoiceNumber } from '@/lib/invoice-number'
import { generateReferenceNumber } from '@/lib/reference-number'
import { getLocalized } from '@/lib/localize'
import { eventSchema, type EventFormData } from '@/lib/validation'
import { parseDatetimeLocal } from '@/lib/timezone'

export async function createEvent(
  data: EventFormData,
): Promise<{ success: boolean; id?: string; error?: string }> {
  await requireAdmin()

  const parsed = eventSchema.safeParse(data)
  if (!parsed.success) return { success: false, error: 'Validation failed' }

  const d = parsed.data
  const [row] = await db
    .insert(events)
    .values({
      titleLocales: { sv: d.titleSv, fi: d.titleFi || undefined, en: d.titleEn || undefined },
      summaryLocales: { sv: d.summarySv || undefined, fi: d.summaryFi || undefined, en: d.summaryEn || undefined },
      descriptionLocales: { sv: d.descriptionSv || undefined, fi: d.descriptionFi || undefined, en: d.descriptionEn || undefined },
      locationLocales: { sv: d.locationSv || undefined, fi: d.locationFi || undefined, en: d.locationEn || undefined },
      date: parseDatetimeLocal(d.date),
      endDate: d.endDate ? parseDatetimeLocal(d.endDate) : null,
      categoryId: d.categoryId || null,
      capacity: d.capacity ? Number(d.capacity) : null,
      price: d.price || null,
      allocationMethod: d.allocationMethod,
      registrationOpensAt: d.registrationOpensAt ? parseDatetimeLocal(d.registrationOpensAt) : null,
      registrationDeadline: d.registrationDeadline ? parseDatetimeLocal(d.registrationDeadline) : null,
      lotteryDate: d.lotteryDate ? parseDatetimeLocal(d.lotteryDate) : null,
      cancellationAllowed: d.cancellationAllowed === 'on',
      cancellationDeadline: d.cancellationDeadline ? parseDatetimeLocal(d.cancellationDeadline) : null,
      guestAllowed: d.guestAllowed === 'on',
      maxGuestsPerMember: d.maxGuestsPerMember ? Number(d.maxGuestsPerMember) : 1,
      guestRegistrationOpensAt: d.guestRegistrationOpensAt ? parseDatetimeLocal(d.guestRegistrationOpensAt) : null,
    })
    .returning({ id: events.id })

  revalidatePath('/members/admin/events')
  return { success: true, id: row.id }
}

export async function updateEvent(
  id: string,
  data: EventFormData,
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin()

  const parsed = eventSchema.safeParse(data)
  if (!parsed.success) return { success: false, error: 'Validation failed' }

  const d = parsed.data
  await db
    .update(events)
    .set({
      titleLocales: { sv: d.titleSv, fi: d.titleFi || undefined, en: d.titleEn || undefined },
      summaryLocales: { sv: d.summarySv || undefined, fi: d.summaryFi || undefined, en: d.summaryEn || undefined },
      descriptionLocales: { sv: d.descriptionSv || undefined, fi: d.descriptionFi || undefined, en: d.descriptionEn || undefined },
      locationLocales: { sv: d.locationSv || undefined, fi: d.locationFi || undefined, en: d.locationEn || undefined },
      date: parseDatetimeLocal(d.date),
      endDate: d.endDate ? parseDatetimeLocal(d.endDate) : null,
      categoryId: d.categoryId || null,
      capacity: d.capacity ? Number(d.capacity) : null,
      price: d.price || null,
      allocationMethod: d.allocationMethod,
      registrationOpensAt: d.registrationOpensAt ? parseDatetimeLocal(d.registrationOpensAt) : null,
      registrationDeadline: d.registrationDeadline ? parseDatetimeLocal(d.registrationDeadline) : null,
      lotteryDate: d.lotteryDate ? parseDatetimeLocal(d.lotteryDate) : null,
      cancellationAllowed: d.cancellationAllowed === 'on',
      cancellationDeadline: d.cancellationDeadline ? parseDatetimeLocal(d.cancellationDeadline) : null,
      guestAllowed: d.guestAllowed === 'on',
      maxGuestsPerMember: d.maxGuestsPerMember ? Number(d.maxGuestsPerMember) : 1,
      guestRegistrationOpensAt: d.guestRegistrationOpensAt ? parseDatetimeLocal(d.guestRegistrationOpensAt) : null,
      updatedAt: new Date(),
    })
    .where(eq(events.id, id))

  revalidatePath('/members/admin/events')
  revalidatePath(`/members/admin/events/${id}`)
  return { success: true }
}

export async function deleteEvent(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin()

  const regs = await db
    .select({ id: eventRegistrations.id })
    .from(eventRegistrations)
    .where(eq(eventRegistrations.eventId, id))
    .limit(1)

  if (regs.length > 0) {
    return { success: false, error: 'eventHasRegistrations' }
  }

  await db.delete(events).where(eq(events.id, id))

  revalidatePath('/members/admin/events')
  return { success: true }
}

export async function updateEventStatus(
  id: string,
  status: 'draft' | 'published' | 'cancelled' | 'completed',
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin()

  await db
    .update(events)
    .set({ status, updatedAt: new Date() })
    .where(eq(events.id, id))

  revalidatePath('/members/admin/events')
  revalidatePath(`/members/admin/events/${id}`)
  revalidatePath('/members/events')
  return { success: true }
}


/**
 * Remove a registration. By default unpaid event-fee invoices are cancelled.
 * With `keepFee` (used after the cancellation deadline, when the signup is
 * binding) live invoices stay, and a draft for the member's seats is created
 * if none has been issued yet.
 */
export async function adminCancelRegistration(
  registrationId: string,
  { keepFee = false }: { keepFee?: boolean } = {},
): Promise<{ success: boolean; error?: string; warning?: string }> {
  await requireAdmin()

  const reg = await db
    .select()
    .from(eventRegistrations)
    .where(eq(eventRegistrations.id, registrationId))
    .then((r) => r[0])

  if (!reg) return { success: false, error: 'registrationNotFound' }
  if (reg.status === 'cancelled') return { success: false, error: 'registrationAlreadyCancelled' }

  const event = await db.select().from(events).where(eq(events.id, reg.eventId)).then((r) => r[0])
  const price = Number(event?.price ?? 0)

  // Registration cancel, seat release, waitlist promotion and invoice
  // cleanup commit together, so a failure cannot leave a cancelled
  // registration with a live invoice.
  const result = await db.transaction(async (tx) => {
    const cancelled = await cancelRegistrationRow(reg, tx)
    if (!cancelled) return { cancelled: false as const }

    // Cancel any unpaid event-fee invoice tied to this registration. A paid
    // invoice is left untouched and surfaced as a warning so the admin knows a
    // refund has to be handled manually.
    const linkedInvoices = await tx
      .select({ id: invoices.id, status: invoices.status })
      .from(invoices)
      .where(and(eq(invoices.eventRegistrationId, reg.id), eq(invoices.type, 'event_fee')))

    let warning: string | undefined

    if (keepFee) {
      // Binding signup: only waitlisted/pending members never had a seat to pay for.
      const hadSeat = reg.status === 'registered'
      const hasLiveInvoice = linkedInvoices.some((inv) => inv.status !== 'cancelled')
      if (event && price > 0 && hadSeat && !hasLiveInvoice) {
        const member = await tx.select().from(user).where(eq(user.id, reg.userId)).then((r) => r[0])
        const seats = 1 + reg.guestCount
        const invoiceNumber = await getNextInvoiceNumber(tx)
        await tx.insert(invoices).values({
          invoiceNumber,
          type: 'event_fee',
          userId: reg.userId,
          eventRegistrationId: reg.id,
          seatCount: seats,
          recipientName: member.name,
          recipientEmail: member.email,
          description: eventFeeDescription(getLocalized(event.titleLocales, 'en') || 'Event', seats, false),
          amount: String(price * seats),
          dueDate: eventInvoiceDueDate(event.date),
          referenceNumber: generateReferenceNumber(invoiceNumber),
        })
      }
      return { cancelled: true as const, warning }
    }

    for (const inv of linkedInvoices) {
      if (inv.status === 'draft' || inv.status === 'sent') {
        await tx
          .update(invoices)
          .set({ status: 'cancelled', updatedAt: new Date() })
          .where(eq(invoices.id, inv.id))
      } else if (inv.status === 'paid') {
        warning = 'registrationRemovedInvoicePaid'
      }
    }
    return { cancelled: true as const, warning }
  })

  if (!result.cancelled) return { success: false, error: 'registrationAlreadyCancelled' }
  const { warning } = result

  revalidatePath(`/members/admin/events/${reg.eventId}`)
  revalidatePath('/members/admin/events')
  revalidatePath('/members/admin/invoices')
  revalidatePath(`/members/events/${reg.eventId}`)
  revalidatePath('/members/events')
  return { success: true, warning }
}

export async function runLottery(
  eventId: string,
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin()

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

  revalidatePath(`/members/admin/events/${eventId}`)
  revalidatePath(`/members/events/${eventId}`)
  revalidatePath('/members/events')
  return { success: true }
}
