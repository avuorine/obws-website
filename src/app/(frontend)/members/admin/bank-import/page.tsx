import { getTranslations } from 'next-intl/server'
import { db } from '@/db'
import { invoices } from '@/db/schema'
import { inArray } from 'drizzle-orm'
import { BankImportForm } from '@/components/admin/BankImportForm'

export default async function BankImportPage() {
  const t = await getTranslations('admin')

  const unpaidInvoices = await db
    .select({
      id: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      referenceNumber: invoices.referenceNumber,
      amount: invoices.amount,
      recipientName: invoices.recipientName,
      status: invoices.status,
    })
    .from(invoices)
    .where(inArray(invoices.status, ['sent', 'draft']))

  return (
    <div>
      <h1 className="mb-6 font-serif text-3xl font-bold">{t('bankImport')}</h1>
      <BankImportForm unpaidInvoices={unpaidInvoices} />
    </div>
  )
}
