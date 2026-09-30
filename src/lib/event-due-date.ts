import { ASSOCIATION_TIMEZONE, getDatePartsInTz, parseDatetimeLocal } from './timezone'

export const DUE_DATE_DAYS = 14

const DAY_MS = 24 * 60 * 60 * 1000

/** 23:59:59 on the association-timezone calendar day `offsetDays` after `date`'s. */
function endOfDayInTz(date: Date, offsetDays = 0): Date {
  const { year, month, day } = getDatePartsInTz(date)
  // Date.UTC normalises day overflow/underflow across months and years.
  const target = new Date(Date.UTC(year, month - 1, day + offsetDays))
  const pad = (n: number) => String(n).padStart(2, '0')
  const local = `${target.getUTCFullYear()}-${pad(target.getUTCMonth() + 1)}-${pad(target.getUTCDate())}T23:59`
  return new Date(parseDatetimeLocal(local, ASSOCIATION_TIMEZONE).getTime() + 59_000)
}

/**
 * Due date for an event-fee invoice issued `now`: the usual payment term,
 * but never after the day before the event, and never before the end of
 * today (so an invoice issued on the eve or day of the event is due today
 * rather than already overdue). All days are Europe/Helsinki calendar days.
 */
export function eventInvoiceDueDate(eventDate: Date, now: Date = new Date()): Date {
  const standard = endOfDayInTz(new Date(now.getTime() + DUE_DATE_DAYS * DAY_MS))
  const dayBeforeEvent = endOfDayInTz(eventDate, -1)
  const endOfToday = endOfDayInTz(now)
  const capped = standard < dayBeforeEvent ? standard : dayBeforeEvent
  return capped < endOfToday ? endOfToday : capped
}
