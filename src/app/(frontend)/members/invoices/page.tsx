import { redirect } from 'next/navigation'
import { getTranslations, getLocale } from 'next-intl/server'
import { FileDown } from 'lucide-react'
import { getMember } from '@/lib/auth-server'
import { db } from '@/db'
import { invoices } from '@/db/schema'
import { and, desc, eq, ne } from 'drizzle-orm'
import { getSettings } from '@/lib/settings'
import { formatDate } from '@/lib/format-date'
import { formatReferenceNumber } from '@/lib/reference-number'
import {
  daysOverdue,
  effectiveInvoiceStatus,
  remainingAmount,
  type EffectiveInvoiceStatus,
} from '@/lib/invoice-status'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export default async function MemberInvoicesPage() {
  const member = await getMember()
  if (!member) redirect('/login')

  const t = await getTranslations('invoices')
  const tAdmin = await getTranslations('admin')
  const locale = await getLocale()
  const now = new Date()

  // Only the member's own, issued invoices. Drafts have not been sent yet.
  const rows = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.userId, member.id), ne(invoices.status, 'draft')))
    .orderBy(desc(invoices.createdAt))

  const list = rows
    .map((inv) => ({ ...inv, effective: effectiveInvoiceStatus(inv, now) }))
    // Open invoices first, cancelled last.
    .sort((a, b) => rank(a.effective) - rank(b.effective))

  const open = list.filter((inv) => inv.effective === 'sent' || inv.effective === 'partial' || inv.effective === 'overdue')
  const outstanding = open.reduce((sum, inv) => sum + remainingAmount(inv), 0)
  const overdue = open
    .filter((inv) => inv.effective === 'overdue')
    .reduce((sum, inv) => sum + remainingAmount(inv), 0)

  const settings = await getSettings()

  const statusLabel = (s: EffectiveInvoiceStatus) => {
    switch (s) {
      case 'sent': return tAdmin('sent')
      case 'partial': return tAdmin('partiallyPaid')
      case 'overdue': return tAdmin('overdue')
      case 'paid': return tAdmin('paid')
      case 'cancelled': return tAdmin('cancelled')
      default: return s
    }
  }
  const statusVariant = (s: EffectiveInvoiceStatus) => {
    switch (s) {
      case 'paid': return 'success' as const
      case 'partial': return 'warning' as const
      case 'overdue': return 'destructive' as const
      case 'cancelled': return 'default' as const
      default: return 'outline' as const
    }
  }

  return (
    <div>
      <h1 className="mb-6 font-serif text-3xl font-bold">{t('title')}</h1>

      {list.length === 0 ? (
        <p className="text-muted-foreground">{t('empty')}</p>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg bg-muted p-4">
              <p className="text-sm text-muted-foreground">{t('outstanding')}</p>
              <p className="text-2xl font-bold">€{outstanding.toFixed(2)}</p>
            </div>
            <div className="rounded-lg bg-muted p-4">
              <p className="text-sm text-muted-foreground">{t('overdue')}</p>
              <p className={`text-2xl font-bold ${overdue > 0 ? 'text-[#a63d2a]' : ''}`}>€{overdue.toFixed(2)}</p>
            </div>
          </div>

          {open.length > 0 && settings.iban && (
            <Card>
              <CardContent className="space-y-1 p-4 text-sm">
                <p className="font-medium">{t('howToPay')}</p>
                <p className="text-muted-foreground">{t('howToPayBody')}</p>
                <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                  <dt className="text-muted-foreground">{t('recipient')}</dt>
                  <dd>{settings.name}</dd>
                  <dt className="text-muted-foreground">IBAN</dt>
                  <dd className="font-mono select-all">{settings.iban}</dd>
                  {settings.bic && (
                    <>
                      <dt className="text-muted-foreground">BIC</dt>
                      <dd className="font-mono">{settings.bic}</dd>
                    </>
                  )}
                </dl>
              </CardContent>
            </Card>
          )}

          <ul className="space-y-3">
            {list.map((inv) => {
              const remaining = remainingAmount(inv)
              const isOpen = inv.effective === 'sent' || inv.effective === 'partial' || inv.effective === 'overdue'
              return (
                <li key={inv.id}>
                  <Card className={inv.effective === 'cancelled' ? 'opacity-60' : ''}>
                    <CardContent className="space-y-3 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium">
                            {t('invoiceNumber', { number: inv.invoiceNumber })}
                          </p>
                          <p className="text-sm text-muted-foreground">{inv.description}</p>
                        </div>
                        <Badge variant={statusVariant(inv.effective)}>{statusLabel(inv.effective)}</Badge>
                      </div>
                      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
                        <div>
                          <dt className="text-muted-foreground">{t('amount')}</dt>
                          <dd>€{inv.amount}</dd>
                        </div>
                        {isOpen && (
                          <div>
                            <dt className="text-muted-foreground">{t('toPay')}</dt>
                            <dd className="font-medium">€{remaining.toFixed(2)}</dd>
                          </div>
                        )}
                        <div>
                          <dt className="text-muted-foreground">{t('dueDate')}</dt>
                          <dd className={inv.effective === 'overdue' ? 'text-[#a63d2a]' : ''}>
                            {formatDate(inv.dueDate, locale)}
                            {inv.effective === 'overdue' && (
                              <span className="block text-xs">
                                {tAdmin('daysOverdue', { count: daysOverdue(inv.dueDate, now) })}
                              </span>
                            )}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">{t('reference')}</dt>
                          <dd className="font-mono select-all">{formatReferenceNumber(inv.referenceNumber)}</dd>
                        </div>
                      </dl>
                      {inv.effective !== 'cancelled' && (
                        <Button variant="outline" size="sm" asChild>
                          <a href={`/api/members/invoices/${inv.id}/pdf`} target="_blank" rel="noopener">
                            <FileDown className="mr-1 h-4 w-4" />
                            {t('downloadPdf')}
                          </a>
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

function rank(s: EffectiveInvoiceStatus): number {
  return { overdue: 0, partial: 1, sent: 2, draft: 3, paid: 4, cancelled: 5 }[s]
}
