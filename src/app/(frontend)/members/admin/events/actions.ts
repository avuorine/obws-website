'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/admin-guard'
import { db } from '@/db'
import { events, eventRegistrations, invoices, user } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { cancelRegistrationRow } from '@/lib/registrations'
import { eventFeeDescription } from '@/lib/event-billing'
import { eventInvoiceDueDate } from '@/lib/event-due-date'
import { deliverInvoices, issueEventInvoice } from '@/lib/event-invoicing'
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
      // Signups are binding; the cancellation columns only matter for
      // registrations made before automatic invoicing.
      cancellationAllowed: false,
      cancellationDeadline: null,
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

  // Registration cancel, seat release, waitlist promotion and invoice
  // cleanup commit together, so a failure cannot leave a cancelled
  // registration with a live invoice.
  const result = await db.transaction(async (tx) => {
    // Lock the event first, in the same order as member signups, and
    // re-read the registration under it.
    const event = await tx.select().from(events).where(eq(events.id, reg.eventId)).for('update').then((r) => r[0])
    const price = Number(event?.price ?? 0)
    const current = await tx.select().from(eventRegistrations).where(eq(eventRegistrations.id, registrationId)).then((r) => r[0])
    if (!current) return { cancelled: false as const }

    const { cancelled, issuedInvoiceIds } = await cancelRegistrationRow(current, tx)
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
      const hadSeat = current.status === 'registered'
      const hasLiveInvoice = linkedInvoices.some((inv) => inv.status !== 'cancelled')
      if (event && price > 0 && hadSeat && !hasLiveInvoice) {
        const member = await tx.select().from(user).where(eq(user.id, reg.userId)).then((r) => r[0])
        const seats = 1 + current.guestCount
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
      return { cancelled: true as const, warning, issuedInvoiceIds }
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
    return { cancelled: true as const, warning, issuedInvoiceIds }
  })

  if (!result.cancelled) return { success: false, error: 'registrationAlreadyCancelled' }
  const { warning } = result
  await deliverInvoices(result.issuedInvoiceIds, { reason: 'promoted' })

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

  // One transaction under the event lock: a crash can't leave a partial
  // draw, and a double click can't draw twice.
  const result = await db.transaction(async (tx) => {
    const event = await tx.select().from(events).where(eq(events.id, eventId)).for('update').then((r) => r[0])
    if (!event) return { error: 'Event not found' }
    if (event.lotteryCompleted) return { error: 'Lottery already completed' }
    if (event.allocationMethod !== 'lottery') return { error: 'Not a lottery event' }

    const pending = await tx
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
    const invoiceIds: string[] = []

    for (let i = 0; i < shuffled.length; i++) {
      const status = i < capacity ? 'registered' : 'waitlisted'
      await tx
        .update(eventRegistrations)
        .set({ status })
        .where(eq(eventRegistrations.id, shuffled[i].id))

      if (status === 'registered') {
        registeredCount++
        // Winners who signed up under the binding terms are invoiced now.
        if (shuffled[i].autoInvoice) {
          const id = await issueEventInvoice(tx, {
            event,
            registrationId: shuffled[i].id,
            userId: shuffled[i].userId,
            seats: 1 + shuffled[i].guestCount,
            supplementary: false,
          })
          if (id) invoiceIds.push(id)
        }
      } else {
        waitlistCount++
      }
    }

    await tx
      .update(events)
      .set({
        lotteryCompleted: true,
        registrationCount: registeredCount,
        waitlistCount,
      })
      .where(eq(events.id, eventId))

    return { invoiceIds }
  })

  if ('error' in result) return { success: false, error: result.error }

  // Emails go out after commit; any that fail stay drafts and the nightly
  // job retries them.
  await deliverInvoices(result.invoiceIds, { reason: 'lottery' })

  revalidatePath(`/members/admin/events/${eventId}`)
  revalidatePath(`/members/events/${eventId}`)
  revalidatePath('/members/events')
  revalidatePath('/members/admin/invoices')
  return { success: true }
}
