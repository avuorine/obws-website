import { db } from '@/db'
import { associationSettings, invoiceCounter, invoices } from '@/db/schema'
import { eq, max } from 'drizzle-orm'

export async function getSettings() {
  const row = await db
    .select()
    .from(associationSettings)
    .where(eq(associationSettings.id, 1))
    .then((r) => r[0])

  if (row) return row

  // Seed initial row — carry over nextInvoiceNumber from old invoiceCounter
  // or from the highest existing invoice number
  let seedNextNumber = 1

  const counterRow = await db
    .select()
    .from(invoiceCounter)
    .where(eq(invoiceCounter.id, 1))
    .then((r) => r[0])

  if (counterRow) {
    seedNextNumber = counterRow.nextNumber
  }

  // Also check actual max invoice number (belt and suspenders)
  const [{ maxNum }] = await db
    .select({ maxNum: max(invoices.invoiceNumber) })
    .from(invoices)

  if (maxNum && maxNum >= seedNextNumber) {
    seedNextNumber = maxNum + 1
  }

  const [inserted] = await db
    .insert(associationSettings)
    .values({ id: 1, nextInvoiceNumber: seedNextNumber })
    .onConflictDoNothing()
    .returning()

  return inserted ?? (await db.select().from(associationSettings).where(eq(associationSettings.id, 1)).then((r) => r[0]!))
}
