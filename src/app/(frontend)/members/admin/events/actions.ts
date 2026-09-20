'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/admin-guard'
import { db } from '@/db'
import { events, eventRegistrations, invoices } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { cancelRegistrationRow } from '@/lib/registrations'
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


export async function adminCancelRegistration(
  registrationId: string,
): Promise<{ success: boolean; error?: string; warning?: string }> {
  await requireAdmin()

  const reg = await db
    .select()
    .from(eventRegistrations)
    .where(eq(eventRegistrations.id, registrationId))
    .then((r) => r[0])

  if (!reg) return { success: false, error: 'registrationNotFound' }
  if (reg.status === 'cancelled') return { success: false, error: 'registrationAlreadyCancelled' }

  await cancelRegistrationRow(reg)

  // Cancel any unpaid event-fee invoice tied to this registration. A paid
  // invoice is left untouched and surfaced as a warning so the admin knows a
  // refund has to be handled manually.
  const linkedInvoices = await db
    .select({ id: invoices.id, status: invoices.status })
    .from(invoices)
    .where(and(eq(invoices.eventRegistrationId, reg.id), eq(invoices.type, 'event_fee')))

  let warning: string | undefined
  for (const inv of linkedInvoices) {
    if (inv.status === 'draft' || inv.status === 'sent') {
      await db
        .update(invoices)
        .set({ status: 'cancelled', updatedAt: new Date() })
        .where(eq(invoices.id, inv.id))
    } else if (inv.status === 'paid') {
      warning = 'registrationRemovedInvoicePaid'
    }
  }

  revalidatePath(`/members/admin/events/${reg.eventId}`)
  revalidatePath('/members/admin/events')
  revalidatePath('/members/admin/invoices')
  revalidatePath(`/members/events/${reg.eventId}`)
  revalidatePath('/members/events')
  return { success: true, warning }
}
