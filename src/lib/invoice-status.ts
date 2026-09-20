export type EffectiveInvoiceStatus = 'draft' | 'sent' | 'overdue' | 'paid' | 'cancelled'

interface InvoiceLike {
  status: string
  dueDate: Date
}

/** A sent invoice whose due date has passed. Derived, never stored. */
export function isOverdue(inv: InvoiceLike, now: Date = new Date()): boolean {
  return inv.status === 'sent' && inv.dueDate < now
}

export function effectiveInvoiceStatus(inv: InvoiceLike, now: Date = new Date()): EffectiveInvoiceStatus {
  if (isOverdue(inv, now)) return 'overdue'
  return inv.status as EffectiveInvoiceStatus
}

export function daysOverdue(dueDate: Date, now: Date = new Date()): number {
  return Math.max(0, Math.floor((now.getTime() - dueDate.getTime()) / 86_400_000))
}
