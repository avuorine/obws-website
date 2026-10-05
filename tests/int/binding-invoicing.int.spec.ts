import { describe, it, expect } from 'vitest'
import { bindingInvoiceDueDate, isDueDateReminderDue, seatReleaseDate } from '@/lib/event-due-date'
import { memberCancelBlockReason, signupRule } from '@/lib/event-deadlines'
import { isReleasable, isSyncFresh } from '@/lib/seat-release'
import { toDatetimeLocalString } from '@/lib/timezone'

// Compared as Helsinki wall-clock strings.
const local = (d: Date | null) => (d ? toDatetimeLocalString(d) : null)
const due = (event: string, now: string) => local(bindingInvoiceDueDate(new Date(event), new Date(now)))
const release = (event: string, now: string) => {
  const e = new Date(event)
  return local(seatReleaseDate(bindingInvoiceDueDate(e, new Date(now)), e))
}

describe('bindingInvoiceDueDate', () => {
  it('uses the 7-day term when the event is far away', () => {
    expect(due('2026-12-01T16:00:00Z', '2026-10-01T09:00:00Z')).toBe('2026-10-08T23:59')
  })

  it('is due at the latest 5 days before the event', () => {
    // Event Sat 17 Oct 18:00 Helsinki; signed up 6 Oct -> due 12 Oct, not 13 Oct.
    expect(due('2026-10-17T15:00:00Z', '2026-10-06T09:00:00Z')).toBe('2026-10-12T23:59')
  })

  it('is due today for signups in the last 5 days', () => {
    expect(due('2026-10-17T15:00:00Z', '2026-10-14T09:00:00Z')).toBe('2026-10-14T23:59')
  })
})

describe('seatReleaseDate', () => {
  it('releases 3 days after the due date', () => {
    expect(release('2026-12-01T16:00:00Z', '2026-10-01T09:00:00Z')).toBe('2026-10-11T23:59')
  })

  it('lands exactly on the cutoff when the due date is capped', () => {
    // Due 12 Oct -> released end of 15 Oct, 2 days before the 17 Oct event.
    expect(release('2026-10-17T15:00:00Z', '2026-10-06T09:00:00Z')).toBe('2026-10-15T23:59')
  })

  it('never releases late signups', () => {
    expect(release('2026-10-17T15:00:00Z', '2026-10-14T09:00:00Z')).toBeNull()
  })
})

describe('isDueDateReminderDue', () => {
  const dueDate = new Date('2026-10-08T20:59:59Z') // 8 Oct 23:59:59 Helsinki
  it('fires in the nightly run on the due date', () => {
    expect(isDueDateReminderDue(dueDate, new Date('2026-10-08T01:00:00Z'))).toBe(true)
  })
  it('not the night before, nor after the due date', () => {
    expect(isDueDateReminderDue(dueDate, new Date('2026-10-07T01:00:00Z'))).toBe(false)
    expect(isDueDateReminderDue(dueDate, new Date('2026-10-09T01:00:00Z'))).toBe(false)
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
