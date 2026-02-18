'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/admin-guard'
import { db } from '@/db'
import { invoices, memberFees } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { z } from 'zod/v4'

const matchSchema = z.array(
  z.object({
    invoiceId: z.string(),
    paidAt: z.string(), // ISO date string from booking date
  }),
)

export async function applyBankMatches(
  matches: { invoiceId: string; paidAt: string }[],
): Promise<{ success: boolean; count: number; error?: string }> {
  await requireAdmin()

  const parsed = matchSchema.safeParse(matches)
  if (!parsed.success) {
    return { success: false, count: 0, error: 'Invalid input.' }
  }

  let count = 0

  for (const match of parsed.data) {
    const invoice = await db
      .select()
      .from(invoices)
      .where(eq(invoices.id, match.invoiceId))
      .then((r) => r[0])

    if (!invoice || invoice.status === 'paid') continue

    const paidAt = new Date(match.paidAt)
    const now = new Date()

    await db
      .update(invoices)
      .set({ status: 'paid', paidAt, updatedAt: now })
      .where(eq(invoices.id, match.invoiceId))

    // If membership fee, also mark memberFee as paid
    if (invoice.type === 'membership_fee' && invoice.feePeriodId) {
      await db
        .update(memberFees)
        .set({ status: 'paid', paidAt, updatedAt: now })
        .where(
          and(
            eq(memberFees.userId, invoice.userId),
            eq(memberFees.feePeriodId, invoice.feePeriodId),
          ),
        )
    }

    count++
  }

  revalidatePath('/members/admin/invoices')
  revalidatePath('/members/admin/fees')
  revalidatePath('/members/admin/bank-import')

  return { success: true, count }
}
