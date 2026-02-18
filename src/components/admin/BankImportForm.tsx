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
import { applyBankMatches } from '@/app/(frontend)/members/admin/bank-import/actions'

interface UnpaidInvoice {
  id: string
  invoiceNumber: number
  referenceNumber: string
  amount: string
  recipientName: string
  status: string
}

interface ParsedEntry {
  bookingDate: string
  amount: number
  reference: string
  info: string
  matchedInvoice: UnpaidInvoice | null
  amountMismatch: boolean
  alreadyPaid: boolean
}

interface BankImportFormProps {
  unpaidInvoices: UnpaidInvoice[]
}

function parseCamt052(xmlText: string): ParsedEntry[] | null {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlText, 'text/xml')

  // Check for parse errors
  if (doc.querySelector('parsererror')) return null

  // Verify camt.052 structure
  const root = doc.documentElement
  if (!root.tagName.includes('Document') && root.tagName !== 'Document') return null

  const rpt = doc.getElementsByTagName('BkToCstmrAcctRpt')[0]
  if (!rpt) return null

  const entries: { bookingDate: string; amount: number; reference: string; info: string }[] = []
  const ntryElements = doc.getElementsByTagName('Ntry')

  for (let i = 0; i < ntryElements.length; i++) {
    const ntry = ntryElements[i]

    // Only process credit entries
    const cdtDbt = ntry.getElementsByTagName('CdtDbtInd')[0]?.textContent
    if (cdtDbt !== 'CRDT') continue

    // Amount
    const amtEl = ntry.getElementsByTagName('Amt')[0]
    const amount = amtEl ? parseFloat(amtEl.textContent ?? '0') : 0

    // Booking date
    const bookgDt = ntry.getElementsByTagName('BookgDt')[0]
    const dt = bookgDt?.getElementsByTagName('Dt')[0]?.textContent ?? ''

    // Structured reference (viitemaksu)
    let reference = ''
    const refEl = ntry.getElementsByTagName('Ref')
    for (let j = 0; j < refEl.length; j++) {
      const parent = refEl[j].parentElement
      if (parent?.tagName === 'CdtrRefInf') {
        reference = refEl[j].textContent?.replace(/\s/g, '') ?? ''
        break
      }
    }

    // Fallback to unstructured
    if (!reference) {
      const ustrd = ntry.getElementsByTagName('Ustrd')[0]
      reference = ustrd?.textContent?.replace(/\s/g, '') ?? ''
    }

    // Additional info
    const addlInfo = ntry.getElementsByTagName('AddtlNtryInf')[0]?.textContent ?? ''

    entries.push({ bookingDate: dt, amount, reference, info: addlInfo })
  }

  return entries.length > 0 ? entries as ParsedEntry[] : entries as ParsedEntry[]
}

export function BankImportForm({ unpaidInvoices }: BankImportFormProps) {
  const t = useTranslations('admin')
  const [results, setResults] = useState<ParsedEntry[] | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [successCount, setSuccessCount] = useState<number | null>(null)
  const [isPending, startTransition] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)

  // Build reference -> invoice map
  const refMap = new Map<string, UnpaidInvoice>()
  for (const inv of unpaidInvoices) {
    if (inv.referenceNumber) {
      refMap.set(inv.referenceNumber.replace(/\s/g, ''), inv)
    }
  }

  const handleFile = async () => {
    const file = fileRef.current?.files?.[0]
    if (!file) return

    setError(null)
    setSuccessCount(null)

    const text = await file.text()
    const rawEntries = parseCamt052(text)

    if (!rawEntries) {
      setError(t('invalidFormat'))
      setResults(null)
      return
    }

    // Match entries against invoices
    const matched: ParsedEntry[] = rawEntries.map((entry) => {
      const inv = refMap.get(entry.reference)
      return {
        ...entry,
        matchedInvoice: inv ?? null,
        amountMismatch: inv ? Math.abs(entry.amount - parseFloat(inv.amount)) > 0.01 : false,
        alreadyPaid: inv ? inv.status === 'paid' : false,
      }
    })

    setResults(matched)

    // Auto-select valid matches
    const autoSelected = new Set<number>()
    matched.forEach((entry, i) => {
      if (entry.matchedInvoice && !entry.amountMismatch && !entry.alreadyPaid) {
        autoSelected.add(i)
      }
    })
    setSelected(autoSelected)
  }

  const handleApply = () => {
    if (!results) return

    const matches = Array.from(selected)
      .map((i) => results[i])
      .filter((e) => e.matchedInvoice && !e.alreadyPaid)
      .map((e) => ({
        invoiceId: e.matchedInvoice!.id,
        paidAt: e.bookingDate,
      }))

    if (matches.length === 0) return

    startTransition(async () => {
      const result = await applyBankMatches(matches)
      if (result.success) {
        setSuccessCount(result.count)
        setResults(null)
        setSelected(new Set())
        if (fileRef.current) fileRef.current.value = ''
      }
    })
  }

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
    const selectable = results
      .map((e, i) => (e.matchedInvoice && !e.alreadyPaid ? i : -1))
      .filter((i) => i >= 0)

    if (selectable.every((i) => selected.has(i))) {
      setSelected(new Set())
    } else {
      setSelected(new Set(selectable))
    }
  }

  // Stats
  const stats = results
    ? {
        total: results.length,
        matched: results.filter((e) => e.matchedInvoice && !e.amountMismatch).length,
        alreadyPaid: results.filter((e) => e.alreadyPaid).length,
        unmatched: results.filter((e) => !e.matchedInvoice).length,
        mismatch: results.filter((e) => e.amountMismatch).length,
      }
    : null

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

      {error && (
        <Alert variant="destructive">{error}</Alert>
      )}

      {successCount !== null && (
        <Alert variant="success" className="flex items-center gap-2">
          <CheckCircle className="h-4 w-4" />
          {t('matchesApplied', { count: successCount })}
        </Alert>
      )}

      {results && stats && (
        <>
          {/* Stats summary */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-sm text-muted-foreground">{t('totalEntries')}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-green-600">{stats.matched}</p>
                <p className="text-sm text-muted-foreground">{t('matched')}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-amber-600">{stats.alreadyPaid}</p>
                <p className="text-sm text-muted-foreground">{t('alreadyPaid')}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-muted-foreground">{stats.unmatched}</p>
                <p className="text-sm text-muted-foreground">{t('unmatched')}</p>
              </CardContent>
            </Card>
          </div>

          {/* Results table */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{t('invoiceMatch')}</CardTitle>
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
                        <Checkbox
                          checked={
                            results.some((e) => e.matchedInvoice && !e.alreadyPaid) &&
                            results
                              .map((e, i) =>
                                e.matchedInvoice && !e.alreadyPaid ? i : -1,
                              )
                              .filter((i) => i >= 0)
                              .every((i) => selected.has(i))
                          }
                          onCheckedChange={toggleAll}
                        />
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
                      <tr
                        key={i}
                        className="border-b border-input last:border-0"
                      >
                        <td className="px-4 py-3">
                          {entry.matchedInvoice && !entry.alreadyPaid ? (
                            <Checkbox
                              checked={selected.has(i)}
                              onCheckedChange={() => toggleSelect(i)}
                            />
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {entry.bookingDate}
                        </td>
                        <td className="px-4 py-3">€{entry.amount.toFixed(2)}</td>
                        <td className="px-4 py-3 font-mono text-xs">
                          {entry.reference || '—'}
                        </td>
                        <td className="px-4 py-3">
                          {entry.matchedInvoice ? (
                            <span>
                              #{entry.matchedInvoice.invoiceNumber}{' '}
                              <span className="text-muted-foreground">
                                {entry.matchedInvoice.recipientName}
                              </span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {entry.alreadyPaid ? (
                            <Badge variant="outline">{t('alreadyPaid')}</Badge>
                          ) : entry.amountMismatch ? (
                            <Badge variant="warning">{t('amountMismatch')}</Badge>
                          ) : entry.matchedInvoice ? (
                            <Badge variant="success">{t('matched')}</Badge>
                          ) : (
                            <Badge variant="default">{t('unmatched')}</Badge>
                          )}
                        </td>
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
