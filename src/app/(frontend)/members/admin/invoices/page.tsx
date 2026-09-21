import Link from 'next/link'
import { getTranslations, getLocale } from 'next-intl/server'
import { db } from '@/db'
import { invoices } from '@/db/schema'
import { desc } from 'drizzle-orm'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { InvoiceActions } from '@/components/admin/InvoiceActions'
import { BulkSendButton } from './bulk-send-button'
import { Download, AlertCircle, Clock, FileText, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/format-date'
import { effectiveInvoiceStatus, daysOverdue, remainingAmount, type EffectiveInvoiceStatus } from '@/lib/invoice-status'

const STATUSES: Array<'all' | EffectiveInvoiceStatus> = ['all', 'draft', 'sent', 'partial', 'overdue', 'paid', 'cancelled']
const TYPES = ['all', 'membership_fee', 'event_fee'] as const

export default async function AdminInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; type?: string }>
}) {
  const { status: statusParam, type: typeParam } = await searchParams
  const t = await getTranslations('admin')
  const locale = await getLocale()
  const now = new Date()
  const startOfYear = new Date(now.getFullYear(), 0, 1)

  const filterStatus = STATUSES.includes(statusParam as EffectiveInvoiceStatus) ? (statusParam as EffectiveInvoiceStatus) : 'all'
  const filterType = TYPES.includes(typeParam as (typeof TYPES)[number]) ? (typeParam as (typeof TYPES)[number]) : 'all'

  const allInvoices = await db.select().from(invoices).orderBy(desc(invoices.createdAt))
  const rows = allInvoices.map((inv) => ({ ...inv, effective: effectiveInvoiceStatus(inv, now) }))

  const sum = (list: typeof rows) => list.reduce((acc, inv) => acc + Number(inv.amount), 0)
  // Open invoices count what is still owed, not face value.
  const sumRemaining = (list: typeof rows) => list.reduce((acc, inv) => acc + remainingAmount(inv), 0)
  const overdue = rows.filter((r) => r.effective === 'overdue')
  const outstanding = rows.filter((r) => r.effective === 'sent' || r.effective === 'partial')
  const drafts = rows.filter((r) => r.effective === 'draft')
  const paidThisYear = rows.filter((r) => r.effective === 'paid' && r.paidAt && r.paidAt >= startOfYear)

  const filtered = rows.filter(
    (r) =>
      (filterStatus === 'all' ||
        r.effective === filterStatus ||
        (filterStatus === 'sent' && r.effective === 'partial')) &&
      (filterType === 'all' || r.type === filterType),
  )
  const draftInvoiceIds = drafts.map((inv) => inv.id)

  const href = (next: { status?: string; type?: string }) => {
    const sp = new URLSearchParams()
    const s = next.status ?? filterStatus
    const ty = next.type ?? filterType
    if (s !== 'all') sp.set('status', s)
    if (ty !== 'all') sp.set('type', ty)
    const qs = sp.toString()
    return qs ? `/members/admin/invoices?${qs}` : '/members/admin/invoices'
  }

  const tiles = [
    { key: 'overdue', label: t('overdueInvoices'), count: overdue.length, amount: sumRemaining(overdue), icon: AlertCircle, tone: 'text-[#a63d2a]' },
    { key: 'sent', label: t('outstandingInvoices'), count: outstanding.length, amount: sumRemaining(outstanding), icon: Clock, tone: 'text-foreground' },
    { key: 'draft', label: t('draftInvoices'), count: drafts.length, amount: sum(drafts), icon: FileText, tone: 'text-foreground' },
    { key: 'paid', label: t('paidThisYear'), count: paidThisYear.length, amount: sum(paidThisYear), icon: CheckCircle, tone: 'text-[#4a6741]' },
  ] as const

  const statusVariant = (status: EffectiveInvoiceStatus) => {
    switch (status) {
      case 'paid': return 'success' as const
      case 'sent': return 'outline' as const
      case 'partial': return 'warning' as const
      case 'overdue': return 'destructive' as const
      case 'cancelled': return 'destructive' as const
      default: return 'default' as const
    }
  }

  const typeLabel = (type: string) => (type === 'membership_fee' ? t('membershipFee') : t('eventFee'))

  const statusLabel = (status: string) => {
    switch (status) {
      case 'draft': return t('draft')
      case 'sent': return t('sent')
      case 'partial': return t('partiallyPaid')
      case 'overdue': return t('overdue')
      case 'paid': return t('paid')
      case 'cancelled': return t('cancelled')
      default: return status
    }
  }

  const pill = (active: boolean) =>
    `rounded-full px-3 py-1 text-sm font-medium transition-colors ${
      active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'
    }`

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-serif text-3xl font-bold">{t('invoices')}</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href="/api/export/invoices">
              <Download className="mr-1 h-4 w-4" />
              {t('export')}
            </a>
          </Button>
          {draftInvoiceIds.length > 0 && <BulkSendButton invoiceIds={draftInvoiceIds} />}
        </div>
      </div>

      {/* Summary tiles */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((tile) => {
          const Icon = tile.icon
          const active = filterStatus === tile.key
          return (
            <Link key={tile.key} href={href({ status: active ? 'all' : tile.key })}>
              <Card className={`transition-colors hover:border-primary/50 ${active ? 'border-primary' : ''}`}>
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="rounded-lg bg-muted p-2">
                    <Icon className={`h-5 w-5 ${tile.count > 0 ? tile.tone : 'text-muted-foreground'}`} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{tile.label}</p>
                    <p className="text-2xl font-bold">
                      {tile.count}
                      <span className="ml-2 text-base font-normal text-muted-foreground">€{tile.amount.toFixed(0)}</span>
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {STATUSES.map((s) => (
          <Link key={s} href={href({ status: s })} className={pill(s === filterStatus)}>
            {s === 'all' ? t('all') : statusLabel(s)}
          </Link>
        ))}
        <span className="mx-1 h-5 w-px bg-input" aria-hidden />
        {TYPES.map((ty) => (
          <Link key={ty} href={href({ type: ty })} className={pill(ty === filterType)}>
            {ty === 'all' ? t('allTypes') : typeLabel(ty)}
          </Link>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-muted-foreground">{t('noInvoices')}</p>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-input text-left">
                    <th className="px-4 py-3 font-medium">{t('invoiceNumber')}</th>
                    <th className="px-4 py-3 font-medium">{t('type')}</th>
                    <th className="px-4 py-3 font-medium">{t('recipient')}</th>
                    <th className="px-4 py-3 font-medium">{t('amount')}</th>
                    <th className="px-4 py-3 font-medium">{t('dueDate')}</th>
                    <th className="px-4 py-3 font-medium">{t('referenceNumber')}</th>
                    <th className="px-4 py-3 font-medium">{t('invoiceStatus')}</th>
                    <th className="px-4 py-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((inv) => (
                    <tr key={inv.id} className="border-b border-input last:border-0">
                      <td className="px-4 py-3">
                        <Link href={`/members/admin/invoices/${inv.id}`} className="font-medium text-primary hover:underline">
                          #{inv.invoiceNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline">{typeLabel(inv.type)}</Badge>
                      </td>
                      <td className="px-4 py-3">{inv.recipientName}</td>
                      <td className="px-4 py-3">
                        €{inv.amount}
                        {Number(inv.paidAmount) > 0 && inv.status !== 'paid' && (
                          <span className="block text-xs text-[#8b6914]">{t('paidOfTotal', { paid: inv.paidAmount, total: inv.amount })}</span>
                        )}
                      </td>
                      <td className={`px-4 py-3 ${inv.effective === 'overdue' ? 'text-[#a63d2a]' : 'text-muted-foreground'}`}>
                        {formatDate(inv.dueDate, locale)}
                        {inv.effective === 'overdue' && (
                          <span className="block text-xs">{t('daysOverdue', { count: daysOverdue(inv.dueDate, now) })}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{inv.referenceNumber}</td>
                      <td className="px-4 py-3">
                        <Badge variant={statusVariant(inv.effective)}>{statusLabel(inv.effective)}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <InvoiceActions invoiceId={inv.id} status={inv.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
