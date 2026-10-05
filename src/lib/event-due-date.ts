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

// --- Binding signups (auto-invoiced) ---

export const BINDING_DUE_DATE_DAYS = 7
/** Days after the due date before an unpaid seat is released (bank booking + nightly sync lag). */
export const SEAT_RELEASE_GRACE_DAYS = 3
/** Seats are never released this close to the event; unpaid invoices then stay as debt. */
export const SEAT_RELEASE_CUTOFF_DAYS = 2

/**
 * Due date for a binding signup's invoice issued `now`: 7 days, but at the
 * latest so that the release (due + grace) still lands before the cutoff,
 * and never before the end of today.
 */
export function bindingInvoiceDueDate(eventDate: Date, now: Date = new Date()): Date {
  const standard = endOfDayInTz(new Date(now.getTime() + BINDING_DUE_DATE_DAYS * DAY_MS))
  const latest = endOfDayInTz(eventDate, -(SEAT_RELEASE_GRACE_DAYS + SEAT_RELEASE_CUTOFF_DAYS))
  const endOfToday = endOfDayInTz(now)
  const capped = standard < latest ? standard : latest
  return capped < endOfToday ? endOfToday : capped
}

/**
 * When an unpaid binding invoice's seats are released: the end of the day
 * `SEAT_RELEASE_GRACE_DAYS` after the due date, or null when that would fall
 * inside the cutoff before the event (late signups are never released).
 */
export function seatReleaseDate(dueDate: Date, eventDate: Date): Date | null {
  const release = endOfDayInTz(dueDate, SEAT_RELEASE_GRACE_DAYS)
  const cutoff = endOfDayInTz(eventDate, -SEAT_RELEASE_CUTOFF_DAYS)
  return release <= cutoff ? release : null
}

/** The due-date reminder goes out on the due date itself (the nightly run before it ends). */
export function isDueDateReminderDue(dueDate: Date, now: Date = new Date()): boolean {
  return now < dueDate && dueDate.getTime() - now.getTime() <= DAY_MS
}
