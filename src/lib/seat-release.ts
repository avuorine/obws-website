import { db } from '@/db'
import { bankConnections, eventRegistrations, events, invoices } from '@/db/schema'
import { and, asc, eq, gt, inArray, isNotNull, isNull, lt, lte, ne, sql } from 'drizzle-orm'
import { cancelRegistrationRow, promoteWaitlisted } from './registrations'
import { deliverInvoices } from './event-invoicing'
import { isPaymentReminderDue, paymentReminderDeadline } from './event-due-date'
import { remainingAmount } from './invoice-status'
import { sendPaymentReminder, sendSeatReleased } from './seat-release-email'

const CENT = 0.005
const HOUR_MS = 60 * 60 * 1000

/**
 * Nightly jobs for binding (auto-invoiced) signups, run by the daily cron
 * after the bank sync so every decision sees the latest payments.
 */

// --- Pure rules (unit tested) ---

interface ReleasableInvoice {
  status: string
  seatReleaseAt: Date | null
  paidAmount: string | number | null
}

/**
 * An invoice's seats may be released once its release date has passed and
 * nothing at all has been paid on it. A partial payment means the member is
 * trying to pay: the invoice then simply goes overdue for an admin to chase.
 */
export function isReleasable(inv: ReleasableInvoice, now: Date = new Date()): boolean {
  return (
    inv.status === 'sent' &&
    inv.seatReleaseAt !== null &&
    inv.seatReleaseAt <= now &&
    Number(inv.paidAmount ?? 0) <= CENT
  )
}

/**
 * Releasing depends on the bank sync being current: with a stale sync a
 * paid seat would look unpaid. Requires an active connection that synced
 * without error within the last 30 hours.
 */
export function isSyncFresh(
  connections: { status: string; lastSyncedAt: Date | null; lastSyncError: string | null }[],
  now: Date = new Date(),
): boolean {
  return connections.some(
    (c) =>
      c.status === 'active' &&
      c.lastSyncError === null &&
      c.lastSyncedAt !== null &&
      now.getTime() - c.lastSyncedAt.getTime() <= 30 * HOUR_MS,
  )
}

// --- Jobs ---

/**
 * Binding-signup invoices still in draft: their email failed when the seat
 * was allocated. Skips drafts younger than 10 minutes, which a signup may
 * still be sending.
 */
export async function retryUndeliveredInvoices(now: Date = new Date()): Promise<number> {
  const drafts = await db
    .select({ id: invoices.id })
    .from(invoices)
    .innerJoin(eventRegistrations, eq(eventRegistrations.id, invoices.eventRegistrationId))
    .where(
      and(
        eq(invoices.type, 'event_fee'),
        eq(invoices.status, 'draft'),
        eq(eventRegistrations.autoInvoice, true),
        eq(eventRegistrations.status, 'registered'),
        lt(invoices.createdAt, new Date(now.getTime() - 10 * 60 * 1000)),
      ),
    )
  return deliverInvoices(drafts.map((d) => d.id), { now })
}

/**
 * Payment reminders for binding signups' unpaid invoices, sent on the last
 * banking day of the payment window (the day the seat is released at
 * midnight if still unpaid).
 */
export async function sendPaymentReminders(now: Date = new Date()): Promise<number> {
  const rows = await db
    .select({
      id: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      status: invoices.status,
      recipientName: invoices.recipientName,
      recipientEmail: invoices.recipientEmail,
      amount: invoices.amount,
      paidAmount: invoices.paidAmount,
      dueDate: invoices.dueDate,
      referenceNumber: invoices.referenceNumber,
      seatReleaseAt: invoices.seatReleaseAt,
      eventTitle: events.titleLocales,
    })
    .from(invoices)
    .innerJoin(eventRegistrations, eq(eventRegistrations.id, invoices.eventRegistrationId))
    .innerJoin(events, eq(events.id, eventRegistrations.eventId))
    .where(
      and(
        eq(invoices.type, 'event_fee'),
        eq(invoices.status, 'sent'),
        eq(eventRegistrations.autoInvoice, true),
        isNull(invoices.reminderSentAt),
        lt(invoices.dueDate, now),
        // The window is at most ~a week (3 banking days plus holidays).
        gt(invoices.dueDate, new Date(now.getTime() - 14 * 24 * HOUR_MS)),
      ),
    )

  let sent = 0
  for (const inv of rows) {
    const remaining = remainingAmount(inv)
    if (remaining <= CENT || !isPaymentReminderDue(paymentReminderDeadline(inv), now)) continue

    // Claim first so overlapping runs can't both send.
    const [claimed] = await db
      .update(invoices)
      .set({ reminderSentAt: now })
      .where(and(eq(invoices.id, inv.id), isNull(invoices.reminderSentAt)))
      .returning({ id: invoices.id })
    if (!claimed) continue

    try {
      await sendPaymentReminder({
        to: inv.recipientEmail,
        name: inv.recipientName,
        eventTitle: inv.eventTitle,
        invoiceNumber: inv.invoiceNumber,
        remaining,
        referenceNumber: inv.referenceNumber,
        seatReleaseAt: inv.seatReleaseAt,
      })
      sent++
    } catch (error) {
      console.error(`Failed to send payment reminder for invoice ${inv.id}`, error)
    }
  }
  return sent
}

export async function bankSyncIsFresh(now: Date = new Date()): Promise<boolean> {
  const connections = await db
    .select({
      status: bankConnections.status,
      lastSyncedAt: bankConnections.lastSyncedAt,
      lastSyncError: bankConnections.lastSyncError,
    })
    .from(bankConnections)
  return isSyncFresh(connections, now)
}

type ReleaseOutcome =
  | { released: false; reason: string }
  | {
      released: true
      kind: 'registration' | 'guests'
      notify: { to: string; name: string; invoiceNumber: number; eventTitle: typeof events.$inferSelect.titleLocales }
      promotedInvoiceIds: string[]
    }

/**
 * Release the seats of one unpaid invoice: cancel the invoice and either the
 * whole registration (the member's own invoice) or just the guest seats (a
 * supplementary invoice), then promote from the waitlist. Everything is
 * re-checked under the event and invoice locks.
 */
async function releaseInvoice(invoiceId: string, now: Date): Promise<ReleaseOutcome> {
  return db.transaction(async (tx) => {
    const head = await tx
      .select({ regId: invoices.eventRegistrationId })
      .from(invoices)
      .where(eq(invoices.id, invoiceId))
      .then((r) => r[0])
    if (!head?.regId) return { released: false, reason: 'no_registration' }

    const reg0 = await tx.select().from(eventRegistrations).where(eq(eventRegistrations.id, head.regId)).then((r) => r[0])
    if (!reg0) return { released: false, reason: 'no_registration' }

    // Same lock order as signups: event, then the rows below it.
    const event = await tx.select().from(events).where(eq(events.id, reg0.eventId)).for('update').then((r) => r[0])
    const inv = await tx.select().from(invoices).where(eq(invoices.id, invoiceId)).for('update').then((r) => r[0])
    const reg = await tx.select().from(eventRegistrations).where(eq(eventRegistrations.id, head.regId)).then((r) => r[0])

    if (!event || event.status !== 'published') return { released: false, reason: 'event_not_published' }
    if (!inv || !isReleasable(inv, now)) return { released: false, reason: 'not_releasable' }
    if (!reg || !reg.autoInvoice || reg.status !== 'registered') return { released: false, reason: 'registration_not_live' }

    const notify = { to: inv.recipientEmail, name: inv.recipientName, invoiceNumber: inv.invoiceNumber, eventTitle: event.titleLocales }
    const cancel = { status: 'cancelled' as const, cancelReason: 'unpaid_release', updatedAt: now }

    if (!inv.supplementary) {
      // The member's own seat: release the whole registration, unless any
      // of its invoices has a payment on it (then an admin decides).
      const live = await tx
        .select()
        .from(invoices)
        .where(and(eq(invoices.eventRegistrationId, reg.id), ne(invoices.status, 'cancelled')))
      if (live.some((i) => i.status === 'paid' || Number(i.paidAmount ?? 0) > CENT)) {
        return { released: false, reason: 'payments_on_registration' }
      }
      await tx
        .update(invoices)
        .set(cancel)
        .where(inArray(invoices.id, live.map((i) => i.id)))

      const { cancelled, issuedInvoiceIds } = await cancelRegistrationRow(reg, tx)
      if (!cancelled) throw new Error('Registration changed during release')
      return { released: true, kind: 'registration', notify, promotedInvoiceIds: issuedInvoiceIds }
    }

    // Guest seats only.
    const seats = Math.min(inv.seatCount ?? 1, reg.guestCount)
    await tx.update(invoices).set(cancel).where(eq(invoices.id, inv.id))
    await tx
      .update(eventRegistrations)
      .set({ guestCount: sql`GREATEST(${eventRegistrations.guestCount} - ${seats}, 0)` })
      .where(eq(eventRegistrations.id, reg.id))
    const [updated] = await tx
      .update(events)
      .set({ registrationCount: sql`GREATEST(${events.registrationCount} - ${seats}, 0)` })
      .where(eq(events.id, event.id))
      .returning({ capacity: events.capacity, registrationCount: events.registrationCount })

    const promotedInvoiceIds = updated.capacity
      ? await promoteWaitlisted(tx, event.id, updated.capacity - (updated.registrationCount ?? 0))
      : []
    return { released: true, kind: 'guests', notify, promotedInvoiceIds }
  })
}

export interface ReleaseSummary {
  released: number
  skipped: Record<string, number>
  promotedInvoicesSent: number
}

/**
 * Release every binding invoice whose release date has passed unpaid.
 * Members' own invoices go first, so a supplementary invoice of a released
 * registration is already cancelled by the time it comes up. Safe to re-run:
 * each release re-checks its invoice under lock.
 */
export async function releaseUnpaidSeats(now: Date = new Date()): Promise<ReleaseSummary> {
  const due = await db
    .select({ id: invoices.id })
    .from(invoices)
    .where(
      and(
        eq(invoices.type, 'event_fee'),
        eq(invoices.status, 'sent'),
        isNotNull(invoices.seatReleaseAt),
        lte(invoices.seatReleaseAt, now),
      ),
    )
    .orderBy(asc(invoices.supplementary), asc(invoices.createdAt))

  const summary: ReleaseSummary = { released: 0, skipped: {}, promotedInvoicesSent: 0 }
  for (const { id } of due) {
    let outcome: ReleaseOutcome
    try {
      outcome = await releaseInvoice(id, now)
    } catch (error) {
      console.error(`Failed to release seats for invoice ${id}`, error)
      summary.skipped.error = (summary.skipped.error ?? 0) + 1
      continue
    }
    if (!outcome.released) {
      summary.skipped[outcome.reason] = (summary.skipped[outcome.reason] ?? 0) + 1
      continue
    }
    summary.released++
    try {
      await sendSeatReleased({ ...outcome.notify, kind: outcome.kind })
    } catch (error) {
      console.error(`Failed to send seat-released email for invoice ${id}`, error)
    }
    summary.promotedInvoicesSent += await deliverInvoices(outcome.promotedInvoiceIds, { reason: 'promoted', now })
  }
  return summary
}
