'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/admin-guard'
import { db } from '@/db'
import { invoices, memberFees, feePeriods, user, events, eventRegistrations } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { getNextInvoiceNumber, isDuplicateInvoiceNumber, resyncInvoiceCounter } from '@/lib/invoice-number'
import { generateReferenceNumber } from '@/lib/reference-number'
import { generateInvoicePdf } from '@/lib/invoice-pdf'
import { invoiceEmailHtml } from '@/lib/invoice-email'
import { sendEmail } from '@/lib/email-sender'
import { getLocalized } from '@/lib/localize'
import { getSettings } from '@/lib/settings'

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
      dueDate: period.dueDate,
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
        dueDate: period.dueDate,
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
): Promise<{ success: boolean; count?: number; error?: string }> {
  await requireAdmin()

  const event = await db.select().from(events).where(eq(events.id, eventId)).then((r) => r[0])
  if (!event) return { success: false, error: 'Event not found' }
  if (!event.price || Number(event.price) <= 0) return { success: false, error: 'Event has no price' }

  // Get registered participants without existing invoices
  const registrations = await db
    .select({
      regId: eventRegistrations.id,
      userId: eventRegistrations.userId,
      userName: user.name,
      userEmail: user.email,
      guestCount: eventRegistrations.guestCount,
    })
    .from(eventRegistrations)
    .innerJoin(user, eq(eventRegistrations.userId, user.id))
    .where(
      and(
        eq(eventRegistrations.eventId, eventId),
        eq(eventRegistrations.status, 'registered'),
      ),
    )

  // Filter out those with existing invoices
  const existingInvoices = await db
    .select({ eventRegistrationId: invoices.eventRegistrationId })
    .from(invoices)
    .where(eq(invoices.type, 'event_fee'))

  const existingRegIds = new Set(
    existingInvoices.map((i) => i.eventRegistrationId).filter(Boolean),
  )
  const regsToInvoice = registrations.filter((r) => !existingRegIds.has(r.regId))

  const eventTitle = getLocalized(event.titleLocales, 'en') || 'Event'
  let count = 0

  for (const reg of regsToInvoice) {
    const invoiceNumber = await getNextInvoiceNumber()
    const referenceNumber = generateReferenceNumber(invoiceNumber)
    const totalSeats = 1 + reg.guestCount
    const amount = String(Number(event.price!) * totalSeats)
    const description = reg.guestCount > 0
      ? `Event fee / Evenemangsavgift / Tapahtumamaksu — ${eventTitle} (1 + ${reg.guestCount} guest(s))`
      : `Event fee / Evenemangsavgift / Tapahtumamaksu — ${eventTitle}`

    try {
      await db.insert(invoices).values({
        invoiceNumber,
        type: 'event_fee',
        userId: reg.userId,
        eventRegistrationId: reg.regId,
        recipientName: reg.userName,
        recipientEmail: reg.userEmail,
        description,
        amount,
        dueDate: event.date,
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
  return { success: true, count }
}

export async function sendInvoice(
  invoiceId: string,
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin()

  const invoice = await db.select().from(invoices).where(eq(invoices.id, invoiceId)).then((r) => r[0])
  if (!invoice) return { success: false, error: 'Invoice not found' }
  if (invoice.status !== 'draft') return { success: false, error: 'Invoice is not in draft status' }

  const settings = await getSettings()

  const pdf = await generateInvoicePdf({
    invoiceNumber: invoice.invoiceNumber,
    recipientName: invoice.recipientName,
    recipientEmail: invoice.recipientEmail,
    description: invoice.description,
    amount: invoice.amount,
    dueDate: invoice.dueDate,
    referenceNumber: invoice.referenceNumber,
    createdAt: invoice.createdAt,
  }, settings)

  const html = invoiceEmailHtml({
    invoiceNumber: invoice.invoiceNumber,
    recipientName: invoice.recipientName,
    description: invoice.description,
    amount: invoice.amount,
    dueDate: invoice.dueDate,
    referenceNumber: invoice.referenceNumber,
  }, settings)

  const fromAddress = settings.email
    ? `${settings.name} <${settings.email}>`
    : `${settings.name} <noreply@obws.fi>`

  await sendEmail({
    from: fromAddress,
    to: invoice.recipientEmail,
    subject: `Lasku / Invoice #${invoice.invoiceNumber}`,
    html,
    attachments: [
      {
        filename: `invoice-${invoice.invoiceNumber}.pdf`,
        content: pdf,
      },
    ],
  })

  const now = new Date()
  await db
    .update(invoices)
    .set({ status: 'sent', sentAt: now, updatedAt: now })
    .where(eq(invoices.id, invoiceId))

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

  const now = new Date()
  await db
    .update(invoices)
    .set({ status: 'paid', paidAt: now, updatedAt: now })
    .where(eq(invoices.id, invoiceId))

  // If membership fee, also mark memberFee as paid
  if (invoice.type === 'membership_fee' && invoice.feePeriodId) {
    await db
      .update(memberFees)
      .set({ status: 'paid', paidAt: now, updatedAt: now })
      .where(
        and(
          eq(memberFees.userId, invoice.userId),
          eq(memberFees.feePeriodId, invoice.feePeriodId),
        ),
      )
  }

  revalidatePath('/members/admin/invoices')
  revalidatePath('/members/admin/fees')
  return { success: true }
}

export async function cancelInvoice(
  invoiceId: string,
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin()

  await db
    .update(invoices)
    .set({ status: 'cancelled', updatedAt: new Date() })
    .where(eq(invoices.id, invoiceId))

  revalidatePath('/members/admin/invoices')
  return { success: true }
}

