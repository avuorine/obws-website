import { redirect } from 'next/navigation'
import { getMember } from '@/lib/auth-server'
import { db } from '@/db'
import { invoices } from '@/db/schema'
import { and, eq, ne } from 'drizzle-orm'
import { invoicePdfBuffer } from '@/lib/invoice-pdf'
import { getSettings } from '@/lib/settings'

/**
 * A member's own invoice as PDF. Ownership is part of the query, so another
 * member's invoice and a missing one both return 404 and can't be told apart.
 * Drafts are not issued yet and are never served here.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const member = await getMember()
  if (!member) redirect('/login')
  const { id } = await params

  const invoice = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, id), eq(invoices.userId, member.id), ne(invoices.status, 'draft')))
    .then((r) => r[0])

  if (!invoice) return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'private, no-store' } })

  const pdf = await invoicePdfBuffer(invoice, await getSettings())

  return new Response(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="invoice-${invoice.invoiceNumber}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
