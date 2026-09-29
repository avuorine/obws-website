import { db } from '@/db'
import { eventRegistrations, invoices } from '@/db/schema'
import { and, eq, ne } from 'drizzle-orm'
import { effectiveInvoiceStatus, remainingAmount } from '@/lib/invoice-status'

/** Payment state of one registration, derived from its event-fee invoices. */
export type RegistrationPaymentStatus = 'not_invoiced' | 'draft' | 'sent' | 'partial' | 'overdue' | 'paid'

export interface RegistrationPayment {
  status: RegistrationPaymentStatus
  amount: number
  paid: number
  /** The invoice that decides the status, for linking from the admin table. */
  invoiceId: string | null
}

interface InvoiceLike {
  id: string
  status: string
  dueDate: Date
  amount: string | number
  paidAmount: string | number | null
}

// Most urgent first: the worst invoice decides the registration's status.
const PRIORITY: RegistrationPaymentStatus[] = ['overdue', 'partial', 'sent', 'draft', 'paid']

/**
 * Combine a registration's invoices (a member may have several after adding
 * guests) into one status. Cancelled invoices are ignored.
 */
export function registrationPayment(rows: InvoiceLike[], now: Date = new Date()): RegistrationPayment {
  const live = rows
    .filter((inv) => inv.status !== 'cancelled')
    .map((inv) => ({ inv, status: effectiveInvoiceStatus(inv, now) as RegistrationPaymentStatus }))

  if (live.length === 0) return { status: 'not_invoiced', amount: 0, paid: 0, invoiceId: null }

  const decisive = PRIORITY.map((s) => live.find((l) => l.status === s)).find(Boolean)!
  return {
    status: decisive.status,
    amount: live.reduce((sum, l) => sum + Number(l.inv.amount), 0),
    paid: live.reduce((sum, l) => sum + Number(l.inv.paidAmount ?? 0), 0),
    invoiceId: decisive.inv.id,
  }
}

export interface EventPaymentStats {
  /** Price × seats of registered members (member + guests). */
  expected: number
  /** Face value of sent and paid invoices. */
  invoiced: number
  paid: number
  /** Still owed on sent invoices, overdue included. */
  outstanding: number
  overdue: number
  /** Registered members per payment status. */
  counts: Record<RegistrationPaymentStatus, number>
}

interface RegistrationLike {
  id: string
  status: string
  guestCount: number
}

export function eventPaymentStats(
  registrations: RegistrationLike[],
  invoiceRows: (InvoiceLike & { eventRegistrationId: string | null })[],
  price: number,
  now: Date = new Date(),
): { byRegistration: Map<string, RegistrationPayment>; stats: EventPaymentStats } {
  const grouped = new Map<string, InvoiceLike[]>()
  for (const inv of invoiceRows) {
    if (!inv.eventRegistrationId) continue
    grouped.set(inv.eventRegistrationId, [...(grouped.get(inv.eventRegistrationId) ?? []), inv])
  }

  const byRegistration = new Map<string, RegistrationPayment>()
  for (const reg of registrations) byRegistration.set(reg.id, registrationPayment(grouped.get(reg.id) ?? [], now))

  const counts: Record<RegistrationPaymentStatus, number> = {
    not_invoiced: 0, draft: 0, sent: 0, partial: 0, overdue: 0, paid: 0,
  }
  let expected = 0
  for (const reg of registrations) {
    if (reg.status !== 'registered') continue
    expected += price * (1 + reg.guestCount)
    counts[byRegistration.get(reg.id)!.status]++
  }

  // Money totals cover every live invoice, including ones on cancelled
  // registrations, so a payment awaiting refund is not hidden.
  let invoiced = 0, paid = 0, outstanding = 0, overdue = 0
  for (const inv of invoiceRows) {
    const status = effectiveInvoiceStatus(inv, now)
    if (status === 'cancelled' || status === 'draft') continue
    invoiced += Number(inv.amount)
    paid += Number(inv.paidAmount ?? 0)
    if (status !== 'paid') outstanding += remainingAmount(inv)
    if (status === 'overdue') overdue += remainingAmount(inv)
  }

  return { byRegistration, stats: { expected, invoiced, paid, outstanding, overdue, counts } }
}

/** Load an event's live event-fee invoices and derive payment state. */
export async function getEventPayments(eventId: string, registrations: RegistrationLike[], price: number) {
  const invoiceRows = await db
    .select({
      id: invoices.id,
      eventRegistrationId: invoices.eventRegistrationId,
      status: invoices.status,
      dueDate: invoices.dueDate,
      amount: invoices.amount,
      paidAmount: invoices.paidAmount,
    })
    .from(invoices)
    .innerJoin(eventRegistrations, eq(invoices.eventRegistrationId, eventRegistrations.id))
    .where(
      and(
        eq(eventRegistrations.eventId, eventId),
        eq(invoices.type, 'event_fee'),
        ne(invoices.status, 'cancelled'),
      ),
    )

  return eventPaymentStats(registrations, invoiceRows, price)
}

/** `admin` translation key for a payment status. */
export const PAYMENT_STATUS_KEY = {
  not_invoiced: 'notInvoiced',
  draft: 'draft',
  sent: 'sent',
  partial: 'partiallyPaid',
  overdue: 'overdue',
  paid: 'paid',
} as const satisfies Record<RegistrationPaymentStatus, string>
