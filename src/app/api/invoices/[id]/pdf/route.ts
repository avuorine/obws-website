import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-guard'
import { db } from '@/db'
import { invoices } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { generateInvoicePdf } from '@/lib/invoice-pdf'
import { getSettings } from '@/lib/settings'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireAdmin()
  const { id } = await params

  const invoice = await db
    .select()
    .from(invoices)
    .where(eq(invoices.id, id))
    .then((r) => r[0])

  if (!invoice) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  }

  const settings = await getSettings()

  const pdf = await generateInvoicePdf({
    invoiceNumber: invoice.invoiceNumber,
    recipientName: invoice.recipientName,
    recipientEmail: invoice.recipientEmail,
    description: invoice.description,
    amount: invoice.amount,
    dueDate: invoice.dueDate,
    referenceNumber: invoice.referenceNumber,
    createdAt: invoice.createdAt,
  }, settings)

  return new Response(pdf, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="invoice-${invoice.invoiceNumber}.pdf"`,
    },
  })
}
