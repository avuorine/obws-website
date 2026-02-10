'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/admin-guard'
import { db } from '@/db'
import { events, eventRegistrations } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { eventSchema, type EventFormData } from '@/lib/validation'

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
      date: new Date(d.date),
      endDate: d.endDate ? new Date(d.endDate) : null,
      categoryId: d.categoryId || null,
      capacity: d.capacity ? Number(d.capacity) : null,
      price: d.price || null,
      allocationMethod: d.allocationMethod,
      registrationOpensAt: d.registrationOpensAt ? new Date(d.registrationOpensAt) : null,
      registrationDeadline: d.registrationDeadline ? new Date(d.registrationDeadline) : null,
      lotteryDate: d.lotteryDate ? new Date(d.lotteryDate) : null,
      cancellationAllowed: d.cancellationAllowed === 'on',
      cancellationDeadline: d.cancellationDeadline ? new Date(d.cancellationDeadline) : null,
      guestAllowed: d.guestAllowed === 'on',
      maxGuestsPerMember: d.maxGuestsPerMember ? Number(d.maxGuestsPerMember) : 1,
      guestRegistrationOpensAt: d.guestRegistrationOpensAt ? new Date(d.guestRegistrationOpensAt) : null,
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
      date: new Date(d.date),
      endDate: d.endDate ? new Date(d.endDate) : null,
      categoryId: d.categoryId || null,
      capacity: d.capacity ? Number(d.capacity) : null,
      price: d.price || null,
      allocationMethod: d.allocationMethod,
      registrationOpensAt: d.registrationOpensAt ? new Date(d.registrationOpensAt) : null,
      registrationDeadline: d.registrationDeadline ? new Date(d.registrationDeadline) : null,
      lotteryDate: d.lotteryDate ? new Date(d.lotteryDate) : null,
      cancellationAllowed: d.cancellationAllowed === 'on',
      cancellationDeadline: d.cancellationDeadline ? new Date(d.cancellationDeadline) : null,
      guestAllowed: d.guestAllowed === 'on',
      maxGuestsPerMember: d.maxGuestsPerMember ? Number(d.maxGuestsPerMember) : 1,
      guestRegistrationOpensAt: d.guestRegistrationOpensAt ? new Date(d.guestRegistrationOpensAt) : null,
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


