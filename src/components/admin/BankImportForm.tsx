'use client'

import { useState, useTransition, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert } from '@/components/ui/alert'
import { Upload, CheckCircle } from 'lucide-react'
import { applyBankMatches, type BankMatch } from '@/app/(frontend)/members/admin/bank-import/actions'
import { normalizeReferenceNumber } from '@/lib/reference-number'

interface OpenInvoice {
  id: string
  invoiceNumber: number
  referenceNumber: string
  amount: string
  paidAmount: string
  recipientName: string
  status: string
}

/** How a matched statement row relates to what the invoice still owes. */
type MatchKind = 'exact' | 'split' | 'partial' | 'overpaid'

interface RawEntry {
  bookingDate: string
  amount: number
  reference: string
  info: string
  bankEntryRef: string
}

interface ParsedEntry extends RawEntry {
  matchedInvoice: OpenInvoice | null
  kind: MatchKind | null
  /** Total of all rows in this statement that hit the same invoice. */
  groupTotal: number
  groupSize: number
  alreadyPaid: boolean
}

interface BankImportFormProps {
  unpaidInvoices: OpenInvoice[]
}

function parseCamt052(xmlText: string): RawEntry[] | null {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlText, 'text/xml')

  if (doc.querySelector('parsererror')) return null

  const root = doc.documentElement
  if (!root.tagName.includes('Document') && root.tagName !== 'Document') return null

  const rpt = doc.getElementsByTagName('BkToCstmrAcctRpt')[0]
  if (!rpt) return null

  const entries: RawEntry[] = []
  const ntryElements = doc.getElementsByTagName('Ntry')
  const seenKeys = new Map<string, number>()

  for (let i = 0; i < ntryElements.length; i++) {
    const ntry = ntryElements[i]

    const cdtDbt = ntry.getElementsByTagName('CdtDbtInd')[0]?.textContent
    if (cdtDbt !== 'CRDT') continue

    const amtEl = ntry.getElementsByTagName('Amt')[0]
    const amount = amtEl ? parseFloat(amtEl.textContent ?? '0') : 0

    const bookgDt = ntry.getElementsByTagName('BookgDt')[0]
    const dt = bookgDt?.getElementsByTagName('Dt')[0]?.textContent ?? ''

    // Structured reference (viitemaksu)
    let reference = ''
    const refEl = ntry.getElementsByTagName('Ref')
    for (let j = 0; j < refEl.length; j++) {
      if (refEl[j].parentElement?.tagName === 'CdtrRefInf') {
        reference = refEl[j].textContent?.replace(/\s/g, '') ?? ''
        break
      }
    }
    if (!reference) {
      const ustrd = ntry.getElementsByTagName('Ustrd')[0]
      reference = ustrd?.textContent?.replace(/\s/g, '') ?? ''
    }

    const addlInfo = ntry.getElementsByTagName('AddtlNtryInf')[0]?.textContent ?? ''

    // Bank-side identifier of the entry, used to skip rows already imported.
    // Falls back to a content key with an occurrence counter so two identical
    // payments on the same day stay distinct while re-imports still collide.
    const bankRef =
      ntry.getElementsByTagName('AcctSvcrRef')[0]?.textContent?.trim() ||
      ntry.getElementsByTagName('NtryRef')[0]?.textContent?.trim() ||
      ''
    let bankEntryRef: string
    if (bankRef) {
      bankEntryRef = `bank:${bankRef}`
    } else {
      const key = `${dt}:${amount.toFixed(2)}:${reference}`
      const n = (seenKeys.get(key) ?? 0) + 1
      seenKeys.set(key, n)
      bankEntryRef = `content:${key}#${n}`
    }

    entries.push({ bookingDate: dt, amount, reference, info: addlInfo, bankEntryRef })
  }

  return entries
}

const CENT = 0.01

export function BankImportForm({ unpaidInvoices }: BankImportFormProps) {
  const t = useTranslations('admin')
  const [results, setResults] = useState<ParsedEntry[] | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [applied, setApplied] = useState<{ count: number; duplicates: number; fullyPaid: number } | null>(null)
  const [isPending, startTransition] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)

  // Normalised reference -> invoice, so padded and RF-prefixed bank
  // references match the reference as generated.
  const refMap = new Map<string, OpenInvoice>()
  for (const inv of unpaidInvoices) {
    const key = normalizeReferenceNumber(inv.referenceNumber ?? '')
    if (key) refMap.set(key, inv)
  }

  const remainingOf = (inv: OpenInvoice) => Math.max(0, parseFloat(inv.amount) - parseFloat(inv.paidAmount))

  const handleFile = async () => {
    const file = fileRef.current?.files?.[0]
    if (!file) return

    setError(null)
    setApplied(null)

    const text = await file.text()
    const rawEntries = parseCamt052(text)
    if (!rawEntries) {
      setError(t('invalidFormat'))
      setResults(null)
      return
    }

    // First pass: match each row to an invoice.
    const matchedInvoices = rawEntries.map((entry) => {
      const key = normalizeReferenceNumber(entry.reference)
      return key ? (refMap.get(key) ?? null) : null
    })

    // Group by invoice so several rows for one reference are judged together.
    const groupTotals = new Map<string, { total: number; size: number }>()
    matchedInvoices.forEach((inv, i) => {
      if (!inv) return
      const g = groupTotals.get(inv.id) ?? { total: 0, size: 0 }
      g.total += rawEntries[i].amount
      g.size += 1
      groupTotals.set(inv.id, g)
    })

    const matched: ParsedEntry[] = rawEntries.map((entry, i) => {
      const inv = matchedInvoices[i]
      if (!inv) return { ...entry, matchedInvoice: null, kind: null, groupTotal: 0, groupSize: 0, alreadyPaid: false }
      const g = groupTotals.get(inv.id)!
      const remaining = remainingOf(inv)
      let kind: MatchKind
      if (Math.abs(g.total - remaining) <= CENT) kind = g.size > 1 ? 'split' : 'exact'
      else if (g.total < remaining) kind = 'partial'
      else kind = 'overpaid'
      return {
        ...entry,
        matchedInvoice: inv,
        kind,
        groupTotal: g.total,
        groupSize: g.size,
        alreadyPaid: inv.status === 'paid',
      }
    })

    setResults(matched)

    // Every matched row is a real payment against a known invoice, so all are
    // pre-selected; partials just leave the invoice open with a balance.
    const auto = new Set<number>()
    matched.forEach((e, i) => {
      if (e.matchedInvoice && !e.alreadyPaid) auto.add(i)
    })
    setSelected(auto)
  }

  const handleApply = () => {
    if (!results) return

    const matches: BankMatch[] = Array.from(selected)
      .map((i) => results[i])
      .filter((e) => e.matchedInvoice && !e.alreadyPaid)
      .map((e) => ({
        invoiceId: e.matchedInvoice!.id,
        amount: e.amount,
        paidAt: e.bookingDate,
        reference: e.reference || undefined,
        bankEntryRef: e.bankEntryRef,
      }))

    if (matches.length === 0) return

    startTransition(async () => {
      const result = await applyBankMatches(matches)
      if (result.success) {
        setApplied({ count: result.count, duplicates: result.duplicates, fullyPaid: result.fullyPaid })
        setResults(null)
        setSelected(new Set())
        if (fileRef.current) fileRef.current.value = ''
      } else {
        setError(result.error ?? t('error'))
      }
    })
  }

  const isSelectable = (e: ParsedEntry) => Boolean(e.matchedInvoice) && !e.alreadyPaid

  const toggleSelect = (i: number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  const toggleAll = () => {
    if (!results) return
    const selectable = results.map((e, i) => (isSelectable(e) ? i : -1)).filter((i) => i >= 0)
    setSelected(selectable.every((i) => selected.has(i)) ? new Set() : new Set(selectable))
  }

  const stats = results
    ? {
        total: results.length,
        matched: results.filter((e) => e.kind === 'exact' || e.kind === 'split').length,
        partial: results.filter((e) => e.kind === 'partial').length,
        overpaid: results.filter((e) => e.kind === 'overpaid').length,
        alreadyPaid: results.filter((e) => e.alreadyPaid).length,
        unmatched: results.filter((e) => !e.matchedInvoice).length,
      }
    : null

  const kindBadge = (e: ParsedEntry) => {
    if (e.alreadyPaid) return <Badge variant="outline">{t('alreadyPaid')}</Badge>
    switch (e.kind) {
      case 'exact': return <Badge variant="success">{t('matched')}</Badge>
      case 'split': return <Badge variant="success">{t('splitPayment', { count: e.groupSize })}</Badge>
      case 'partial': return <Badge variant="warning">{t('partialPayment')}</Badge>
      case 'overpaid': return <Badge variant="destructive">{t('overpayment')}</Badge>
      default: return <Badge variant="default">{t('unmatched')}</Badge>
    }
  }

  const selectableCount = results?.filter(isSelectable).length ?? 0
  const allSelected = selectableCount > 0 && results!.every((e, i) => !isSelectable(e) || selected.has(i))

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground">{t('uploadBankStatement')}</p>

      <div className="flex items-end gap-4">
        <div className="flex-1">
          <Input ref={fileRef} type="file" accept=".xml" />
        </div>
        <Button onClick={handleFile}>
          <Upload className="mr-1 h-4 w-4" />
          {t('parseFile')}
        </Button>
      </div>

      {error && <Alert variant="destructive">{error}</Alert>}

      {applied && (
        <Alert variant="success" className="flex items-center gap-2">
          <CheckCircle className="h-4 w-4" />
          <span>
            {t('paymentsRecorded', { count: applied.count, fullyPaid: applied.fullyPaid })}
            {applied.duplicates > 0 && ` ${t('duplicatesSkipped', { count: applied.duplicates })}`}
          </span>
        </Alert>
      )}

      {results && stats && (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <Card><CardContent className="p-4"><p className="text-2xl font-bold">{stats.total}</p><p className="text-sm text-muted-foreground">{t('total')}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-2xl font-bold text-green-600">{stats.matched}</p><p className="text-sm text-muted-foreground">{t('matched')}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-2xl font-bold text-[#8b6914]">{stats.partial}</p><p className="text-sm text-muted-foreground">{t('partialPayment')}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-2xl font-bold text-[#a63d2a]">{stats.overpaid}</p><p className="text-sm text-muted-foreground">{t('overpayment')}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-2xl font-bold text-muted-foreground">{stats.alreadyPaid}</p><p className="text-sm text-muted-foreground">{t('alreadyPaid')}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-2xl font-bold text-muted-foreground">{stats.unmatched}</p><p className="text-sm text-muted-foreground">{t('unmatched')}</p></CardContent></Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{t('bankEntries')}</CardTitle>
                <Button onClick={handleApply} disabled={isPending || selected.size === 0}>
                  {isPending ? t('applying') : t('applyMatches')}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-input text-left">
                      <th className="px-4 py-3">
                        {selectableCount > 0 && <Checkbox checked={allSelected} onCheckedChange={toggleAll} />}
                      </th>
                      <th className="px-4 py-3 font-medium">{t('bankDate')}</th>
                      <th className="px-4 py-3 font-medium">{t('bankAmount')}</th>
                      <th className="px-4 py-3 font-medium">{t('referenceNumber')}</th>
                      <th className="px-4 py-3 font-medium">{t('invoiceMatch')}</th>
                      <th className="px-4 py-3 font-medium">{t('status')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((entry, i) => (
                      <tr key={i} className="border-b border-input last:border-0">
                        <td className="px-4 py-3">
                          {isSelectable(entry) && (
                            <Checkbox checked={selected.has(i)} onCheckedChange={() => toggleSelect(i)} />
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{entry.bookingDate}</td>
                        <td className="px-4 py-3">€{entry.amount.toFixed(2)}</td>
                        <td className="px-4 py-3 font-mono text-xs">
                          {entry.reference || '—'}
                          {entry.matchedInvoice && entry.reference !== entry.matchedInvoice.referenceNumber && (
                            <span className="block text-muted-foreground">→ {entry.matchedInvoice.referenceNumber}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {entry.matchedInvoice ? (
                            <div>
                              <span>
                                #{entry.matchedInvoice.invoiceNumber}{' '}
                                <span className="text-muted-foreground">{entry.matchedInvoice.recipientName}</span>
                              </span>
                              {entry.kind && entry.kind !== 'exact' && (
                                <span className="block text-xs text-muted-foreground">
                                  {t('groupVsRemaining', {
                                    total: entry.groupTotal.toFixed(2),
                                    remaining: remainingOf(entry.matchedInvoice).toFixed(2),
                                  })}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">{kindBadge(entry)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
