import { db } from '@/db'
import { associationSettings, invoices } from '@/db/schema'
import { sql, eq, max } from 'drizzle-orm'
import { getSettings } from './settings'

export async function getNextInvoiceNumber(): Promise<number> {
  // Ensure the settings row exists with a correct seed value
  await getSettings()

  const result = await db
    .update(associationSettings)
    .set({ nextInvoiceNumber: sql`${associationSettings.nextInvoiceNumber} + 1` })
    .where(eq(associationSettings.id, 1))
    .returning({ current: sql<number>`${associationSettings.nextInvoiceNumber} - 1` })

  return result[0].current
}

/**
 * Resync the invoice counter to MAX(invoice_number) + 1.
 * Call this when a duplicate invoice number error occurs.
 */
export async function resyncInvoiceCounter(): Promise<void> {
  const [{ maxNum }] = await db
    .select({ maxNum: max(invoices.invoiceNumber) })
    .from(invoices)

  const next = (maxNum ?? 0) + 1

  await db
    .update(associationSettings)
    .set({ nextInvoiceNumber: next })
    .where(eq(associationSettings.id, 1))
}

/**
 * Check if a PostgreSQL error is a unique constraint violation on invoice_number.
 */
export function isDuplicateInvoiceNumber(error: unknown): boolean {
  return (
    error instanceof Error &&
    'code' in error &&
    (error as { code: string }).code === '23505' &&
    error.message.includes('invoice_number')
  )
}
