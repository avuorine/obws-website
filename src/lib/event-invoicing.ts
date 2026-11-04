import { db } from '@/db'
import { events, eventRegistrations, invoices, user } from '@/db/schema'
import { and, eq } from 'drizzle-orm'
import { getNextInvoiceNumber } from './invoice-number'
import { generateReferenceNumber } from './reference-number'
import { invoicePdfBuffer } from './invoice-pdf'
import { invoiceEmailHtml, type BindingInvoiceReason } from './invoice-email'
import { sendEmail } from './email-sender'
import { getSettings } from './settings'
import { getLocalized } from './localize'
import { eventFeeDescription } from './event-billing'
import { bindingInvoiceDueDate, eventInvoiceDueDate, seatReleaseDate } from './event-due-date'

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]
type EventRow = typeof events.$inferSelect

/**
 * Create a draft event-fee invoice for `seats` seats of a registration,
 * inside the caller's transaction so it commits or rolls back with the
 * seat allocation. Returns null for free events. Deliver it with
 * `deliverInvoices` once the transaction has committed.
 */
export async function issueEventInvoice(
  tx: Tx,
  {
    event,
    registrationId,
    userId,
    seats,
    supplementary,
  }: { event: EventRow; registrationId: string; userId: string; seats: number; supplementary: boolean },
): Promise<string | null> {
  const price = Number(event.price ?? 0)
  if (price <= 0 || seats <= 0) return null

  const member = await tx
    .select({ name: user.name, email: user.email })
    .from(user)
    .where(eq(user.id, userId))
    .then((r) => r[0])
  if (!member) return null

  const invoiceNumber = await getNextInvoiceNumber(tx)
  const dueDate = bindingInvoiceDueDate()
  const [row] = await tx
    .insert(invoices)
    .values({
      invoiceNumber,
      type: 'event_fee',
      userId,
      eventRegistrationId: registrationId,
      seatCount: seats,
      supplementary,
      recipientName: member.name,
      recipientEmail: member.email,
      description: eventFeeDescription(getLocalized(event.titleLocales, 'en') || 'Event', seats, supplementary),
      amount: String(price * seats),
      dueDate,
      seatReleaseAt: seatReleaseDate(dueDate, event.date),
      referenceNumber: generateReferenceNumber(invoiceNumber),
    })
    .returning({ id: invoices.id })
  return row.id
}

export type DeliverResult = 'sent' | 'not_draft' | 'not_found'

/**
 * Email a draft invoice and mark it sent. An event fee's due date is
 * recomputed at send time (a draft may have waited), and for a binding
 * signup so is the seat release date: the payment term starts when the
 * member actually receives the invoice. Throws if the email fails, leaving
 * the invoice a draft.
 */
export async function deliverInvoice(
  invoiceId: string,
  { reason, now = new Date() }: { reason?: BindingInvoiceReason; now?: Date } = {},
): Promise<DeliverResult> {
  const draft = await db.select().from(invoices).where(eq(invoices.id, invoiceId)).then((r) => r[0])
  if (!draft) return 'not_found'
  if (draft.status !== 'draft') return 'not_draft'

  let dueDate = draft.dueDate
  let seatReleaseAt = draft.seatReleaseAt
  let binding = false
  if (draft.type === 'event_fee' && draft.eventRegistrationId) {
    const ctx = await db
      .select({ date: events.date, autoInvoice: eventRegistrations.autoInvoice })
      .from(eventRegistrations)
      .innerJoin(events, eq(events.id, eventRegistrations.eventId))
      .where(eq(eventRegistrations.id, draft.eventRegistrationId))
      .then((r) => r[0])
    if (ctx?.autoInvoice) {
      binding = true
      dueDate = bindingInvoiceDueDate(now)
      seatReleaseAt = seatReleaseDate(dueDate, ctx.date)
    } else if (ctx) {
      dueDate = eventInvoiceDueDate(ctx.date, now)
    }
  }
  const invoice = { ...draft, dueDate }

  const settings = await getSettings()
  const pdf = await invoicePdfBuffer(invoice, settings)
  const html = invoiceEmailHtml(
    {
      invoiceNumber: invoice.invoiceNumber,
      recipientName: invoice.recipientName,
      description: invoice.description,
      amount: invoice.amount,
      dueDate: invoice.dueDate,
      referenceNumber: invoice.referenceNumber,
    },
    settings,
    binding ? { reason, seatReleaseAt } : undefined,
  )

  await sendEmail({
    from: settings.email ? `${settings.name} <${settings.email}>` : `${settings.name} <noreply@obws.fi>`,
    to: invoice.recipientEmail,
    subject: `Lasku / Invoice #${invoice.invoiceNumber}`,
    html,
    attachments: [{ filename: `invoice-${invoice.invoiceNumber}.pdf`, content: pdf }],
  })

  // Conditional on still being a draft, so a draft cancelled meanwhile
  // (e.g. the registration was removed) is not resurrected.
  await db
    .update(invoices)
    .set({ status: 'sent', sentAt: now, dueDate, seatReleaseAt, updatedAt: now })
    .where(and(eq(invoices.id, invoiceId), eq(invoices.status, 'draft')))
  return 'sent'
}

/**
 * Deliver several invoices one by one. Never throws: an invoice whose email
 * fails stays a draft and the nightly job retries it.
 */
export async function deliverInvoices(
  invoiceIds: (string | null | undefined)[],
  opts: { reason?: BindingInvoiceReason; now?: Date } = {},
): Promise<number> {
  let sent = 0
  for (const id of invoiceIds) {
    if (!id) continue
    try {
      if ((await deliverInvoice(id, opts)) === 'sent') sent++
    } catch (error) {
      console.error(`Failed to deliver invoice ${id}`, error)
    }
  }
  return sent
}
