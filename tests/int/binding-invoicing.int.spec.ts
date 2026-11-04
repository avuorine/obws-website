import { describe, it, expect } from 'vitest'
import {
  bindingInvoiceDueDate,
  bindingPaymentDeadline,
  isPaymentReminderDue,
  paymentReminderDeadline,
  seatReleaseDate,
} from '@/lib/event-due-date'
import { memberCancelBlockReason, signupRule } from '@/lib/event-deadlines'
import { isReleasable, isSyncFresh } from '@/lib/seat-release'
import { toDatetimeLocalString } from '@/lib/timezone'
import { addBankingDays, easterSunday, isBankingDay } from '@/lib/working-days'

// Compared as Helsinki wall-clock strings.
const local = (d: Date | null) => (d ? toDatetimeLocalString(d) : null)
const due = (now: string) => local(bindingInvoiceDueDate(new Date(now)))
const release = (event: string, now: string) => {
  const e = new Date(event)
  return local(seatReleaseDate(bindingInvoiceDueDate(new Date(now)), e))
}
const FAR_EVENT = '2028-06-01T16:00:00Z'

describe('bindingInvoiceDueDate', () => {
  it('is due at the end of the day of issue', () => {
    expect(due('2026-10-05T09:00:00Z')).toBe('2026-10-05T23:59')
  })

  it('uses Helsinki days, not UTC days', () => {
    // 23:30 Helsinki on 5 Oct (20:30 UTC) and 00:30 Helsinki on 6 Oct (21:30 UTC 5 Oct).
    expect(due('2026-10-05T20:30:00Z')).toBe('2026-10-05T23:59')
    expect(due('2026-10-05T21:30:00Z')).toBe('2026-10-06T23:59')
  })
})

describe('working days', () => {
  it('computes Easter Sunday', () => {
    expect(easterSunday(2024)).toEqual({ year: 2024, month: 3, day: 31 })
    expect(easterSunday(2025)).toEqual({ year: 2025, month: 4, day: 20 })
    expect(easterSunday(2026)).toEqual({ year: 2026, month: 4, day: 5 })
    expect(easterSunday(2027)).toEqual({ year: 2027, month: 3, day: 28 })
  })

  it('skips weekends and Finnish bank holidays', () => {
    expect(isBankingDay({ year: 2026, month: 10, day: 10 })).toBe(false) // Saturday
    expect(isBankingDay({ year: 2026, month: 5, day: 14 })).toBe(false) // Ascension Day
    expect(isBankingDay({ year: 2026, month: 6, day: 19 })).toBe(false) // Midsummer Eve
    expect(isBankingDay({ year: 2027, month: 1, day: 6 })).toBe(false) // Epiphany
    expect(isBankingDay({ year: 2026, month: 6, day: 18 })).toBe(true)
  })

  it('counts banking days after a day, not including it', () => {
    expect(addBankingDays({ year: 2026, month: 10, day: 5 }, 3)).toEqual({ year: 2026, month: 10, day: 8 })
  })
})

describe('seatReleaseDate', () => {
  it('releases at the end of the 3rd banking day after signup', () => {
    expect(release(FAR_EVENT, '2026-10-05T09:00:00Z')).toBe('2026-10-08T23:59') // Mon -> Thu
    expect(release(FAR_EVENT, '2026-10-09T09:00:00Z')).toBe('2026-10-14T23:59') // Fri -> Wed
    expect(release(FAR_EVENT, '2026-10-10T09:00:00Z')).toBe('2026-10-14T23:59') // Sat -> Wed
  })

  it('skips bank holidays', () => {
    expect(release(FAR_EVENT, '2027-03-25T09:00:00Z')).toBe('2027-04-01T23:59') // Easter
    expect(release(FAR_EVENT, '2026-12-23T09:00:00Z')).toBe('2026-12-30T23:59') // Christmas
    expect(release(FAR_EVENT, '2026-06-18T09:00:00Z')).toBe('2026-06-24T23:59') // Midsummer
    expect(release(FAR_EVENT, '2027-12-03T09:00:00Z')).toBe('2027-12-09T23:59') // Independence Day
  })

  it('handles the DST change (Helsinki leaves summer time on 25 Oct 2026)', () => {
    const r = seatReleaseDate(bindingInvoiceDueDate(new Date('2026-10-22T09:00:00Z')), new Date(FAR_EVENT))
    expect(local(r)).toBe('2026-10-27T23:59')
    expect(r?.toISOString()).toBe('2026-10-27T21:59:59.000Z')
  })

  it('releases up to 2 days before the event, never later', () => {
    // Event Sat 10 Oct 18:00 Helsinki; cutoff end of Thu 8 Oct.
    expect(release('2026-10-10T15:00:00Z', '2026-10-05T09:00:00Z')).toBe('2026-10-08T23:59')
    expect(release('2026-10-10T15:00:00Z', '2026-10-06T09:00:00Z')).toBeNull()
  })
})

describe('isPaymentReminderDue', () => {
  const deadline = new Date('2026-10-08T20:59:59Z') // Thu 8 Oct 23:59:59 Helsinki
  it('fires in the nightly run on the last day of the payment window', () => {
    expect(isPaymentReminderDue(deadline, new Date('2026-10-08T01:00:00Z'))).toBe(true)
    expect(isPaymentReminderDue(deadline, new Date('2026-10-07T21:30:00Z'))).toBe(true) // 00:30 Helsinki
  })
  it('not the night before, nor after the deadline', () => {
    expect(isPaymentReminderDue(deadline, new Date('2026-10-07T01:00:00Z'))).toBe(false)
    expect(isPaymentReminderDue(deadline, new Date('2026-10-09T01:00:00Z'))).toBe(false)
  })
  it('keys to the release date, or the payment deadline when seats are never released', () => {
    const dueDate = bindingInvoiceDueDate(new Date('2026-10-05T09:00:00Z'))
    expect(paymentReminderDeadline({ dueDate, seatReleaseAt: deadline })).toBe(deadline)
    expect(local(paymentReminderDeadline({ dueDate, seatReleaseAt: null }))).toBe(
      local(bindingPaymentDeadline(dueDate)),
    )
  })
})

describe('isReleasable', () => {
  const now = new Date('2026-10-12T01:00:00Z')
  const inv = { status: 'sent', seatReleaseAt: new Date('2026-10-11T20:59:59Z'), paidAmount: '0.00' }
  it('releases an unpaid sent invoice past its release date', () => {
    expect(isReleasable(inv, now)).toBe(true)
  })
  it('keeps the seat before the release date, or with no release date', () => {
    expect(isReleasable(inv, new Date('2026-10-11T01:00:00Z'))).toBe(false)
    expect(isReleasable({ ...inv, seatReleaseAt: null }, now)).toBe(false)
  })
  it('keeps the seat on any payment, and for paid, draft or cancelled invoices', () => {
    expect(isReleasable({ ...inv, paidAmount: '5.00' }, now)).toBe(false)
    expect(isReleasable({ ...inv, status: 'paid' }, now)).toBe(false)
    expect(isReleasable({ ...inv, status: 'draft' }, now)).toBe(false)
    expect(isReleasable({ ...inv, status: 'cancelled' }, now)).toBe(false)
  })
})

describe('isSyncFresh', () => {
  const now = new Date('2026-10-12T01:05:00Z')
  const ok = { status: 'active', lastSyncedAt: new Date('2026-10-12T01:01:00Z'), lastSyncError: null }
  it('needs an active connection synced without error in the last 30 hours', () => {
    expect(isSyncFresh([ok], now)).toBe(true)
    expect(isSyncFresh([], now)).toBe(false)
    expect(isSyncFresh([{ ...ok, lastSyncError: 'boom' }], now)).toBe(false)
    expect(isSyncFresh([{ ...ok, status: 'expired' }], now)).toBe(false)
    expect(isSyncFresh([{ ...ok, lastSyncedAt: new Date('2026-10-10T01:00:00Z') }], now)).toBe(false)
  })
})

describe('memberCancelBlockReason', () => {
  const event = { registrationDeadline: null, cancellationAllowed: true, cancellationDeadline: null }
  it('a binding signup cannot give up an allocated seat', () => {
    expect(memberCancelBlockReason(event, { autoInvoice: true, status: 'registered' })).toBe('registrationBinding')
  })
  it('a binding signup can leave the waitlist or the lottery', () => {
    expect(memberCancelBlockReason(event, { autoInvoice: true, status: 'waitlisted' })).toBeNull()
    expect(memberCancelBlockReason(event, { autoInvoice: true, status: 'pending' })).toBeNull()
  })
  it('an older registration keeps the event cancellation rules', () => {
    expect(memberCancelBlockReason(event, { autoInvoice: false, status: 'registered' })).toBeNull()
    expect(
      memberCancelBlockReason({ ...event, cancellationAllowed: false }, { autoInvoice: false, status: 'registered' }),
    ).toBe('cancellationNotAllowed')
  })
})

describe('signupRule', () => {
  const event = { registrationDeadline: null, cancellationAllowed: true, cancellationDeadline: null }
  it('new signups and binding registrations are binding', () => {
    expect(signupRule(event, null)).toBe('binding')
    expect(signupRule(event, { autoInvoice: true, status: 'registered' })).toBe('binding')
  })
  it('older registrations show their original rule', () => {
    expect(signupRule(event, { autoInvoice: false, status: 'registered' })).toBe('cancelAnytime')
  })
})
