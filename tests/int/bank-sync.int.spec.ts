import { describe, it, expect } from 'vitest'
import { generateKeyPairSync, createVerify } from 'crypto'
import { ebJwt, consentValidUntil, type EbTransaction } from '@/lib/enablebanking'
import { syncWindowStart, toSyncEntries, dueReminder, REMINDER_14_DAYS, REMINDER_3_DAYS } from '@/lib/bank-sync'
import { matchEntries, type OpenInvoice } from '@/lib/bank-matching'
import { pickAccount } from '@/lib/bank-connection'
import { findReferenceInText, isValidFinnishReference, isValidRfReference } from '@/lib/reference-number'

const now = new Date('2026-10-01T12:00:00Z')

describe('ebJwt', () => {
  it('signs an RS256 JWT with the Enable Banking header and claims', () => {
    const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
    const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
    const jwt = ebJwt('app-123', pem, now)
    const [h, b, sig] = jwt.split('.')
    expect(JSON.parse(Buffer.from(h, 'base64url').toString())).toEqual({ typ: 'JWT', alg: 'RS256', kid: 'app-123' })
    const body = JSON.parse(Buffer.from(b, 'base64url').toString())
    expect(body).toMatchObject({ iss: 'enablebanking.com', aud: 'api.enablebanking.com' })
    expect(body.exp - body.iat).toBe(3600)
    expect(createVerify('RSA-SHA256').update(`${h}.${b}`).verify(publicKey, Buffer.from(sig, 'base64url'))).toBe(true)
  })

  it('requests the bank maximum consent, else 180 days', () => {
    expect(consentValidUntil({ maximum_consent_validity: 90 * 86400 }, now).getTime()).toBe(now.getTime() + (90 * 86400 - 60) * 1000)
    expect(consentValidUntil(undefined, now).getTime()).toBe(now.getTime() + (180 * 86400 - 60) * 1000)
  })
})

describe('reference helpers', () => {
  it('validates Finnish and RF references', () => {
    expect(isValidFinnishReference('102542')).toBe(true)
    expect(isValidFinnishReference('102543')).toBe(false)
    expect(isValidFinnishReference('00000000000000102542')).toBe(true)
    expect(isValidRfReference('RF41000000000000102542')).toBe(true)
    expect(isValidRfReference('RF42000000000000102542')).toBe(false)
  })

  it('finds a reference in free text with grouping spaces', () => {
    expect(findReferenceInText('Jäsenmaksu viite 10254 2 kiitos')).toBe('102542')
    expect(findReferenceInText('Payment RF41 0000 0000 0000 1025 42')).toBe('RF41000000000000102542')
    expect(findReferenceInText('Lahjoitus, ei viitettä 2026')).toBe('')
  })
})

describe('syncWindowStart', () => {
  it('overlaps the last sync by three days', () => {
    expect(syncWindowStart(new Date('2026-09-30T01:00:00Z'), now)).toBe('2026-09-27')
  })
  it('starts 30 days back on the first sync', () => {
    expect(syncWindowStart(null, now)).toBe('2026-09-01')
  })
  it('never goes more than 89 days back', () => {
    expect(syncWindowStart(new Date('2026-01-01T00:00:00Z'), now)).toBe('2026-07-04')
  })
})

describe('toSyncEntries', () => {
  const tx = (over: Partial<EbTransaction>): EbTransaction => ({
    entry_reference: 'ARCH1',
    transaction_amount: { currency: 'EUR', amount: '30.00' },
    credit_debit_indicator: 'CRDT',
    status: 'BOOK',
    booking_date: '2026-09-29',
    reference_number: '102542',
    debtor: { name: 'Test Payer' },
    ...over,
  })

  it('keeps booked credits and keys them like the camt upload', () => {
    const entries = toSyncEntries([tx({}), tx({ credit_debit_indicator: 'DBIT' }), tx({ status: 'PDNG' })])
    expect(entries).toEqual([
      { bankEntryRef: 'bank:ARCH1', bookingDate: '2026-09-29', amount: 30, reference: '102542', remittance: '', debtorName: 'Test Payer' },
    ])
  })

  it('falls back to the reference in the remittance text and to other ids', () => {
    const [a, b, c, d] = toSyncEntries([
      tx({ reference_number: null, remittance_information: ['Viite 10254 2'] }),
      tx({ entry_reference: null, transaction_id: 'T9' }),
      tx({ entry_reference: null, transaction_id: null }),
      tx({ entry_reference: null, transaction_id: null }),
    ])
    expect(a.reference).toBe('102542')
    expect(b.bankEntryRef).toBe('eb:T9')
    // Two identical payments without ids stay distinct.
    expect(c.bankEntryRef).not.toBe(d.bankEntryRef)
  })
})

describe('dueReminder', () => {
  const until = (days: number) => new Date(now.getTime() + days * 86_400_000)
  it('sends the 14-day then the 3-day reminder once each', () => {
    expect(dueReminder(until(20), 0, now)).toBe(0)
    expect(dueReminder(until(10), 0, now)).toBe(REMINDER_14_DAYS)
    expect(dueReminder(until(10), REMINDER_14_DAYS, now)).toBe(0)
    expect(dueReminder(until(2), REMINDER_14_DAYS, now)).toBe(REMINDER_3_DAYS)
    expect(dueReminder(until(2), REMINDER_14_DAYS | REMINDER_3_DAYS, now)).toBe(0)
    expect(dueReminder(until(-1), 0, now)).toBe(0)
  })
})

describe('matchEntries', () => {
  const inv = (id: string, ref: string, amount: string, paid = '0'): OpenInvoice => ({
    id, invoiceNumber: 1, referenceNumber: ref, amount, paidAmount: paid, recipientName: 'X', status: 'sent',
  })
  it('classifies exact, split, partial, overpaid and unmatched', () => {
    const invoices = [inv('a', '102542', '30.00'), inv('b', '102555', '40.00'), inv('c', '102568', '20.00'), inv('d', '102571', '10.00')]
    const result = matchEntries(
      [
        { amount: 30, reference: 'RF18000000000000102542' },
        { amount: 20, reference: '102555' },
        { amount: 20, reference: '102555' },
        { amount: 5, reference: '102568' },
        { amount: 15, reference: '102571' },
        { amount: 12, reference: '999' },
      ],
      invoices,
    )
    expect(result.map((r) => r.kind)).toEqual(['exact', 'split', 'split', 'partial', 'overpaid', null])
  })
})

describe('pickAccount', () => {
  const accounts = [
    { uid: '1', iban: 'FI11 1111 1111 1111 11', name: 'Main' },
    { uid: '2', iban: 'FI22 2222 2222 2222 22', name: 'Savings' },
  ]
  it('picks the account matching the association IBAN, else the only one', () => {
    expect(pickAccount(accounts, 'fi2222222222222222')?.uid).toBe('2')
    expect(pickAccount(accounts, '')).toBeNull()
    expect(pickAccount([accounts[0]], null)?.uid).toBe('1')
  })
})
