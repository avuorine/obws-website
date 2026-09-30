import { normalizeReferenceNumber } from './reference-number'

/**
 * Matching of incoming bank payments to open invoices by reference number,
 * shared by the camt.052 upload (in the browser) and the nightly bank sync
 * (on the server). Pure: no database access.
 */

export interface OpenInvoice {
  id: string
  invoiceNumber: number
  referenceNumber: string
  amount: string
  paidAmount: string
  recipientName: string
  status: string
}

/** How a matched payment relates to what the invoice still owes. */
export type MatchKind = 'exact' | 'split' | 'partial' | 'overpaid'

export interface MatchableEntry {
  amount: number
  reference: string
}

export type Matched<E> = E & {
  matchedInvoice: OpenInvoice | null
  kind: MatchKind | null
  /** Total of all entries in this batch that hit the same invoice. */
  groupTotal: number
  groupSize: number
  alreadyPaid: boolean
}

const CENT = 0.01

export const remainingOf = (inv: OpenInvoice) =>
  Math.max(0, parseFloat(inv.amount) - parseFloat(inv.paidAmount))

export function matchEntries<E extends MatchableEntry>(entries: E[], openInvoices: OpenInvoice[]): Matched<E>[] {
  // Normalised reference -> invoice, so padded and RF-prefixed bank
  // references match the reference as generated.
  const refMap = new Map<string, OpenInvoice>()
  for (const inv of openInvoices) {
    const key = normalizeReferenceNumber(inv.referenceNumber ?? '')
    if (key) refMap.set(key, inv)
  }

  const matchedInvoices = entries.map((entry) => {
    const key = normalizeReferenceNumber(entry.reference)
    return key ? (refMap.get(key) ?? null) : null
  })

  // Group by invoice so several payments for one reference are judged together.
  const groupTotals = new Map<string, { total: number; size: number }>()
  matchedInvoices.forEach((inv, i) => {
    if (!inv) return
    const g = groupTotals.get(inv.id) ?? { total: 0, size: 0 }
    g.total += entries[i].amount
    g.size += 1
    groupTotals.set(inv.id, g)
  })

  return entries.map((entry, i) => {
    const inv = matchedInvoices[i]
    if (!inv) return { ...entry, matchedInvoice: null, kind: null, groupTotal: 0, groupSize: 0, alreadyPaid: false }
    const g = groupTotals.get(inv.id)!
    const remaining = remainingOf(inv)
    let kind: MatchKind
    if (Math.abs(g.total - remaining) <= CENT) kind = g.size > 1 ? 'split' : 'exact'
    else if (g.total < remaining) kind = 'partial'
    else kind = 'overpaid'
    return {
      ...entry,
      matchedInvoice: inv,
      kind,
      groupTotal: g.total,
      groupSize: g.size,
      alreadyPaid: inv.status === 'paid',
    }
  })
}
