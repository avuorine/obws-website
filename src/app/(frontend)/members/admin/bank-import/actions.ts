'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/admin-guard'
import { db } from '@/db'
import { bankTransactions, invoices } from '@/db/schema'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod/v4'
import { recordPayment } from '@/lib/payments'

const matchSchema = z.array(
  z.object({
    invoiceId: z.string(),
    amount: z.number().positive(),
    paidAt: z.string(), // ISO date string from booking date
    reference: z.string().optional(),
    bankEntryRef: z.string().min(1),
  }),
)

export type BankMatch = z.infer<typeof matchSchema>[number]

export async function applyBankMatches(
  matches: BankMatch[],
): Promise<{ success: boolean; count: number; duplicates: number; fullyPaid: number; error?: string }> {
  await requireAdmin()

  const parsed = matchSchema.safeParse(matches)
  if (!parsed.success) {
    return { success: false, count: 0, duplicates: 0, fullyPaid: 0, error: 'Invalid input.' }
  }

  let count = 0
  let duplicates = 0
  const touched = new Set<string>()

  for (const match of parsed.data) {
    const result = await db.transaction((tx) =>
      recordPayment(tx, {
        invoiceId: match.invoiceId,
        amount: match.amount,
        paidAt: new Date(match.paidAt),
        reference: match.reference ?? null,
        bankEntryRef: match.bankEntryRef,
        source: 'bank_import',
      }),
    )
    if (result === 'recorded') {
      count++
      touched.add(match.invoiceId)
    } else if (result === 'duplicate') {
      duplicates++
    }
  }

  let fullyPaid = 0
  for (const id of touched) {
    const inv = await db.select({ status: invoices.status }).from(invoices).where(eq(invoices.id, id)).then((r) => r[0])
    if (inv?.status === 'paid') fullyPaid++
  }

  revalidatePath('/members/admin/invoices')
  revalidatePath('/members/admin/fees')
  revalidatePath('/members/admin/bank-import')
  revalidatePath('/members/admin')

  return { success: true, count, duplicates, fullyPaid }
}

function revalidateBankPages() {
  revalidatePath('/members/admin/bank-import')
  revalidatePath('/members/admin/invoices')
  revalidatePath('/members/admin/fees')
  revalidatePath('/members/admin')
}

/** Record a synced bank transaction from the review queue against an invoice. */
export async function recordBankTransaction(
  transactionId: string,
  invoiceId: string,
): Promise<{ success: boolean; error?: string }> {
  const admin = await requireAdmin()

  const row = await db
    .select()
    .from(bankTransactions)
    .where(and(eq(bankTransactions.id, transactionId), eq(bankTransactions.status, 'needs_review')))
    .then((r) => r[0])
  if (!row) return { success: false, error: 'bankTransactionNotFound' }

  const result = await db.transaction(async (tx) => {
    const recorded = await recordPayment(tx, {
      invoiceId,
      amount: Number(row.amount),
      paidAt: row.bookingDate,
      reference: row.reference,
      bankEntryRef: row.bankEntryRef,
      source: 'bank_sync',
    })
    if (recorded === 'invoice_not_found') return recorded
    await tx
      .update(bankTransactions)
      .set({ status: 'recorded', invoiceId, resolvedBy: admin.id, resolvedAt: new Date() })
      .where(eq(bankTransactions.id, row.id))
    return recorded
  })
  if (result === 'invoice_not_found') return { success: false, error: 'invoiceNotFound' }

  revalidateBankPages()
  return { success: true }
}

/** Dismiss a synced transaction that isn't an invoice payment (e.g. a donation). */
export async function ignoreBankTransaction(transactionId: string): Promise<{ success: boolean }> {
  const admin = await requireAdmin()
  await db
    .update(bankTransactions)
    .set({ status: 'ignored', resolvedBy: admin.id, resolvedAt: new Date() })
    .where(and(eq(bankTransactions.id, transactionId), eq(bankTransactions.status, 'needs_review')))
  revalidateBankPages()
  return { success: true }
}
