'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/admin-guard'
import { db } from '@/db'
import { invoices, memberFees, feePeriods, user, events, eventRegistrations } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { getNextInvoiceNumber, isDuplicateInvoiceNumber, resyncInvoiceCounter } from '@/lib/invoice-number'
import { generateReferenceNumber } from '@/lib/reference-number'
import { getLocalized } from '@/lib/localize'
import { getEventBillingSummary, eventFeeDescription } from '@/lib/event-billing'
import { DUE_DATE_DAYS, eventInvoiceDueDate } from '@/lib/event-due-date'
import { recordRemainingAsManual } from '@/lib/payments'
import { deliverInvoice } from '@/lib/event-invoicing'

function computeDueDate(): Date {
  return new Date(Date.now() + DUE_DATE_DAYS * 24 * 60 * 60 * 1000)
}

export async function createMembershipInvoice(
  feePeriodId: string,
  userId: string,
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin()

  const period = await db.select().from(feePeriods).where(eq(feePeriods.id, feePeriodId)).then((r) => r[0])
  if (!period) return { success: false, error: 'Fee period not found' }

  const member = await db.select().from(user).where(eq(user.id, userId)).then((r) => r[0])
  if (!member) return { success: false, error: 'Member not found' }

  const invoiceNumber = await getNextInvoiceNumber()
  const referenceNumber = generateReferenceNumber(invoiceNumber)

  try {
    await db.insert(invoices).values({
      invoiceNumber,
      type: 'membership_fee',
      userId,
      feePeriodId,
      recipientName: member.name,
      recipientEmail: member.email,
      description: `Membership fee / Medlemsavgift / Jäsenmaksu — ${period.name}`,
      amount: period.amount,
      dueDate: computeDueDate(),
      referenceNumber,
    })
  } catch (error) {
    if (isDuplicateInvoiceNumber(error)) {
      await resyncInvoiceCounter()
      return { success: false, error: `Invoice number ${invoiceNumber} already exists. The counter has been corrected — please try again.` }
    }
    throw error
  }

  revalidatePath('/members/admin/invoices')
  return { success: true }
}

export async function bulkCreateMembershipInvoices(
  feePeriodId: string,
): Promise<{ success: boolean; count?: number; error?: string }> {
  await requireAdmin()

  const period = await db.select().from(feePeriods).where(eq(feePeriods.id, feePeriodId)).then((r) => r[0])
  if (!period) return { success: false, error: 'Fee period not found' }

  // Get unpaid member fees without existing invoices
  const unpaidFees = await db
    .select({
      memberFeeId: memberFees.id,
      userId: memberFees.userId,
      userName: user.name,
      userEmail: user.email,
    })
    .from(memberFees)
    .innerJoin(user, eq(memberFees.userId, user.id))
    .where(
      and(
        eq(memberFees.feePeriodId, feePeriodId),
        eq(memberFees.status, 'unpaid'),
      ),
    )

  // Filter out those who already have an invoice for this period
  const existingInvoices = await db
    .select({ userId: invoices.userId })
    .from(invoices)
    .where(
      and(
        eq(invoices.feePeriodId, feePeriodId),
        eq(invoices.type, 'membership_fee'),
      ),
    )

  const existingUserIds = new Set(existingInvoices.map((i) => i.userId))
  const feesToInvoice = unpaidFees.filter((f) => !existingUserIds.has(f.userId))

  const dueDate = computeDueDate()
  let count = 0
  for (const fee of feesToInvoice) {
    const invoiceNumber = await getNextInvoiceNumber()
    const referenceNumber = generateReferenceNumber(invoiceNumber)

    try {
      await db.insert(invoices).values({
        invoiceNumber,
        type: 'membership_fee',
        userId: fee.userId,
        feePeriodId,
        recipientName: fee.userName,
        recipientEmail: fee.userEmail,
        description: `Membership fee / Medlemsavgift / Jäsenmaksu — ${period.name}`,
        amount: period.amount,
        dueDate,
        referenceNumber,
      })
      count++
    } catch (error) {
      if (isDuplicateInvoiceNumber(error)) {
        await resyncInvoiceCounter()
        return { success: false, error: `Invoice number ${invoiceNumber} already exists. The counter has been corrected — please try again.`, count }
      }
      throw error
    }
  }

  revalidatePath('/members/admin/invoices')
  revalidatePath(`/members/admin/fees/${feePeriodId}`)
  return { success: true, count }
}

export async function createEventInvoices(
  eventId: string,
): Promise<{ success: boolean; created?: number; updated?: number; overbilled?: number; error?: string }> {
  await requireAdmin()

  const event = await db.select().from(events).where(eq(events.id, eventId)).then((r) => r[0])
  if (!event) return { success: false, error: 'Event not found' }
  if (!event.price || Number(event.price) <= 0) return { success: false, error: 'Event has no price' }

  const price = Number(event.price)
  const eventTitle = getLocalized(event.titleLocales, 'en') || 'Event'
  const dueDate = eventInvoiceDueDate(event.date)
  const summary = await getEventBillingSummary(eventId)

  let created = 0
  let updated = 0

  for (const reg of summary.registrations) {
    // Sent and paid invoices are immutable. Anything still owed beyond them
    // goes on a draft: amended in place if one exists, otherwise a new one.
    const owedSeats = reg.currentSeats - reg.issuedSeats
    if (owedSeats < 0) continue // overbilled; reported, handled manually

    if (reg.draft) {
      if (owedSeats === 0) {
        await db
          .update(invoices)
          .set({ status: 'cancelled', updatedAt: new Date() })
          .where(eq(invoices.id, reg.draft.id))
        updated++
      } else if (reg.draft.seatCount !== owedSeats) {
        await db
          .update(invoices)
          .set({
            seatCount: owedSeats,
            amount: String(price * owedSeats),
            description: eventFeeDescription(eventTitle, owedSeats, reg.issuedSeats > 0),
            dueDate,
            updatedAt: new Date(),
          })
          .where(eq(invoices.id, reg.draft.id))
        updated++
      }
      continue
    }

    if (owedSeats === 0) continue

    const invoiceNumber = await getNextInvoiceNumber()
    const referenceNumber = generateReferenceNumber(invoiceNumber)

    try {
      await db.insert(invoices).values({
        invoiceNumber,
        type: 'event_fee',
        userId: reg.userId,
        eventRegistrationId: reg.regId,
        seatCount: owedSeats,
        recipientName: reg.userName,
        recipientEmail: reg.userEmail,
        description: eventFeeDescription(eventTitle, owedSeats, reg.issuedSeats > 0),
        amount: String(price * owedSeats),
        dueDate,
        referenceNumber,
      })
      created++
    } catch (error) {
      if (isDuplicateInvoiceNumber(error)) {
        await resyncInvoiceCounter()
        return { success: false, error: `Invoice number ${invoiceNumber} already exists. The counter has been corrected — please try again.`, created, updated }
      }
      throw error
    }
  }

  revalidatePath('/members/admin/invoices')
  revalidatePath(`/members/admin/events/${eventId}`)
  return { success: true, created, updated, overbilled: summary.overbilled }
}

export async function sendInvoice(
  invoiceId: string,
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin()

  const result = await deliverInvoice(invoiceId)
  if (result === 'not_found') return { success: false, error: 'Invoice not found' }
  if (result === 'not_draft') return { success: false, error: 'Invoice is not in draft status' }

  revalidatePath('/members/admin/invoices')
  return { success: true }
}

export async function bulkSendInvoices(
  invoiceIds: string[],
): Promise<{ success: boolean; count?: number; error?: string }> {
  await requireAdmin()

  let count = 0
  for (const id of invoiceIds) {
    const result = await sendInvoice(id)
    if (result.success) count++
  }

  return { success: true, count }
}

export async function markInvoicePaid(
  invoiceId: string,
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin()

  const invoice = await db.select().from(invoices).where(eq(invoices.id, invoiceId)).then((r) => r[0])
  if (!invoice) return { success: false, error: 'Invoice not found' }

  // Records a manual payment for the outstanding balance; the linked
  // membership fee is updated by the payment sync.
  await db.transaction((tx) => recordRemainingAsManual(tx, invoiceId))

  revalidatePath('/members/admin/invoices')
  revalidatePath(`/members/admin/invoices/${invoiceId}`)
  revalidatePath('/members/admin/fees')
  return { success: true }
}

export async function cancelInvoice(
  invoiceId: string,
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin()

  const invoice = await db.select().from(invoices).where(eq(invoices.id, invoiceId)).then((r) => r[0])
  if (!invoice) return { success: false, error: 'invoiceNotFound' }
  if (invoice.status === 'paid') return { success: false, error: 'invoicePaidNotCancellable' }
  if (invoice.status === 'cancelled') return { success: true }

  await db
    .update(invoices)
    .set({ status: 'cancelled', updatedAt: new Date() })
    .where(eq(invoices.id, invoiceId))

  revalidatePath('/members/admin/invoices')
  revalidatePath(`/members/admin/invoices/${invoiceId}`)
  if (invoice.eventRegistrationId) {
    const reg = await db
      .select({ eventId: eventRegistrations.eventId })
      .from(eventRegistrations)
      .where(eq(eventRegistrations.id, invoice.eventRegistrationId))
      .then((r) => r[0])
    if (reg) revalidatePath(`/members/admin/events/${reg.eventId}`)
  }
  return { success: true }
}

