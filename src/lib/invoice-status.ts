export type EffectiveInvoiceStatus = 'draft' | 'sent' | 'partial' | 'overdue' | 'paid' | 'cancelled'

interface InvoiceLike {
  status: string
  dueDate: Date
  amount?: string | number
  paidAmount?: string | number | null
}

/** A sent invoice whose due date has passed. Derived, never stored. */
export function isOverdue(inv: InvoiceLike, now: Date = new Date()): boolean {
  return inv.status === 'sent' && inv.dueDate < now
}

/** A sent invoice with some, but not all, of its amount paid. */
export function isPartiallyPaid(inv: InvoiceLike): boolean {
  return inv.status === 'sent' && Number(inv.paidAmount ?? 0) > 0.005
}

export function remainingAmount(inv: InvoiceLike): number {
  return Math.max(0, Number(inv.amount ?? 0) - Number(inv.paidAmount ?? 0))
}

/**
 * Overdue wins over partial: an invoice that is both is first and foremost
 * something the member still owes and is late on.
 */
export function effectiveInvoiceStatus(inv: InvoiceLike, now: Date = new Date()): EffectiveInvoiceStatus {
  if (isOverdue(inv, now)) return 'overdue'
  if (isPartiallyPaid(inv)) return 'partial'
  return inv.status as EffectiveInvoiceStatus
}

export function daysOverdue(dueDate: Date, now: Date = new Date()): number {
  return Math.max(0, Math.floor((now.getTime() - dueDate.getTime()) / 86_400_000))
}
