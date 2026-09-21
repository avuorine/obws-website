'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/admin-guard'
import { db } from '@/db'
import { invoices } from '@/db/schema'
import { eq } from 'drizzle-orm'
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
