import { describe, it, expect } from 'vitest'
import { eventInvoiceDueDate } from '@/lib/event-due-date'
import { toDatetimeLocalString } from '@/lib/timezone'

// Due dates are compared as Helsinki wall-clock strings.
const due = (event: string, now: string) =>
  toDatetimeLocalString(eventInvoiceDueDate(new Date(event), new Date(now)))

describe('eventInvoiceDueDate', () => {
  it('uses the 14-day term when the event is far away', () => {
    expect(due('2026-12-01T16:00:00Z', '2026-10-01T09:00:00Z')).toBe('2026-10-15T23:59')
  })

  it('caps at the day before the event', () => {
    // Event Tue 6 Oct 18:00 Helsinki; issued 1 Oct
    expect(due('2026-10-06T15:00:00Z', '2026-10-01T09:00:00Z')).toBe('2026-10-05T23:59')
  })

  it('is due today when issued on the eve or day of the event', () => {
    expect(due('2026-10-06T15:00:00Z', '2026-10-05T10:00:00Z')).toBe('2026-10-05T23:59')
    expect(due('2026-10-06T15:00:00Z', '2026-10-06T08:00:00Z')).toBe('2026-10-06T23:59')
  })

  it('is due today for an event in the past', () => {
    expect(due('2026-09-01T15:00:00Z', '2026-10-01T09:00:00Z')).toBe('2026-10-01T23:59')
  })

  it('uses Helsinki days, not UTC days', () => {
    // 00:30 Helsinki on 7 Oct is still 6 Oct in UTC; the day before is 6 Oct.
    expect(due('2026-10-06T21:30:00Z', '2026-10-01T09:00:00Z')).toBe('2026-10-06T23:59')
    // Issued 23:30 Helsinki on 1 Oct (20:30 UTC): "today" is 1 Oct.
    expect(due('2026-10-01T22:30:00Z', '2026-10-01T20:30:00Z')).toBe('2026-10-01T23:59')
  })

  it('handles the DST change (Helsinki leaves summer time on 25 Oct 2026)', () => {
    // Issued 20 Oct, term ends 3 Nov after the switch to UTC+2.
    const d = eventInvoiceDueDate(new Date('2026-12-01T16:00:00Z'), new Date('2026-10-20T09:00:00Z'))
    expect(toDatetimeLocalString(d)).toBe('2026-11-03T23:59')
    expect(d.toISOString()).toBe('2026-11-03T21:59:59.000Z')
  })
})
