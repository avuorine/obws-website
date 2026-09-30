import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-guard'
import { db } from '@/db'
import { invoices } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { invoicePdfBuffer } from '@/lib/invoice-pdf'
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

  const pdf = await invoicePdfBuffer(invoice, settings)

  return new Response(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="invoice-${invoice.invoiceNumber}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
