import { db } from '@/db'
import { invoices, invoicePayments, memberFees } from '@/db/schema'
import { eq, and, sql } from 'drizzle-orm'

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]
type Executor = Tx | typeof db

export interface PaymentInput {
  invoiceId: string
  amount: number
  paidAt: Date
  reference?: string | null
  /** Bank-side identifier of the statement entry. Unique, so re-imports are no-ops. */
  bankEntryRef?: string | null
  source: 'bank_import' | 'manual'
}

export type RecordPaymentResult = 'recorded' | 'duplicate' | 'invoice_not_found'

/** Two decimals, as numeric columns are read back as strings. */
const money = (n: number) => n.toFixed(2)
const CENT = 0.005

/**
 * Recompute an invoice's paid total and status from its payment rows and
 * keep the linked membership fee in step. Cancelled invoices keep their
 * status but still track what was paid.
 */
export async function syncInvoiceFromPayments(ex: Executor, invoiceId: string): Promise<void> {
  const invoice = await ex.select().from(invoices).where(eq(invoices.id, invoiceId)).then((r) => r[0])
  if (!invoice) return

  const [{ total, lastPaidAt }] = await ex
    .select({
      total: sql<string>`coalesce(sum(${invoicePayments.amount}), 0)`,
      lastPaidAt: sql<Date | null>`max(${invoicePayments.paidAt})`,
    })
    .from(invoicePayments)
    .where(eq(invoicePayments.invoiceId, invoiceId))

  const paid = Number(total)
  const fullyPaid = paid >= Number(invoice.amount) - CENT
  const now = new Date()

  let status = invoice.status
  if (invoice.status !== 'cancelled') {
    if (fullyPaid) status = 'paid'
    else if (invoice.status === 'paid') status = 'sent'
  }

  await ex
    .update(invoices)
    .set({
      paidAmount: money(paid),
      paidAt: fullyPaid ? (lastPaidAt ? new Date(lastPaidAt) : now) : null,
      status,
      updatedAt: now,
    })
    .where(eq(invoices.id, invoiceId))

  if (invoice.type === 'membership_fee' && invoice.feePeriodId && invoice.status !== 'cancelled') {
    await ex
      .update(memberFees)
      .set(
        fullyPaid
          ? { status: 'paid', paidAt: lastPaidAt ? new Date(lastPaidAt) : now, updatedAt: now }
          : { status: 'unpaid', paidAt: null, updatedAt: now },
      )
      .where(and(eq(memberFees.userId, invoice.userId), eq(memberFees.feePeriodId, invoice.feePeriodId)))
  }
}

/**
 * Record one payment and resync the invoice. A payment whose bankEntryRef
 * already exists is skipped, which is what makes importing the same bank
 * statement twice harmless.
 */
export async function recordPayment(ex: Executor, input: PaymentInput): Promise<RecordPaymentResult> {
  const invoice = await ex
    .select({ id: invoices.id })
    .from(invoices)
    .where(eq(invoices.id, input.invoiceId))
    .then((r) => r[0])
  if (!invoice) return 'invoice_not_found'

  if (input.bankEntryRef) {
    const dup = await ex
      .select({ id: invoicePayments.id })
      .from(invoicePayments)
      .where(eq(invoicePayments.bankEntryRef, input.bankEntryRef))
      .then((r) => r[0])
    if (dup) return 'duplicate'
  }

  await ex.insert(invoicePayments).values({
    invoiceId: input.invoiceId,
    amount: money(input.amount),
    paidAt: input.paidAt,
    reference: input.reference ?? null,
    bankEntryRef: input.bankEntryRef ?? null,
    source: input.source,
  })

  await syncInvoiceFromPayments(ex, input.invoiceId)
  return 'recorded'
}

/** Record a manual payment covering whatever is still outstanding. */
export async function recordRemainingAsManual(ex: Executor, invoiceId: string, paidAt: Date = new Date()): Promise<void> {
  const invoice = await ex.select().from(invoices).where(eq(invoices.id, invoiceId)).then((r) => r[0])
  if (!invoice) return
  const remaining = Number(invoice.amount) - Number(invoice.paidAmount)
  if (remaining > CENT) {
    await recordPayment(ex, { invoiceId, amount: remaining, paidAt, source: 'manual' })
  } else {
    await syncInvoiceFromPayments(ex, invoiceId)
  }
}

/** Remove manual payments only; bank-imported payments are facts and stay. */
export async function removeManualPayments(ex: Executor, invoiceId: string): Promise<void> {
  await ex
    .delete(invoicePayments)
    .where(and(eq(invoicePayments.invoiceId, invoiceId), eq(invoicePayments.source, 'manual')))
  await syncInvoiceFromPayments(ex, invoiceId)
}
