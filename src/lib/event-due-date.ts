import { ASSOCIATION_TIMEZONE, getDatePartsInTz, parseDatetimeLocal } from './timezone'
import { addBankingDays, type CalendarDay } from './working-days'

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

/** 00:00 on `date`'s association-timezone calendar day. */
function startOfDayInTz(date: Date): Date {
  const { year, month, day } = getDatePartsInTz(date)
  const pad = (n: number) => String(n).padStart(2, '0')
  return parseDatetimeLocal(`${year}-${pad(month)}-${pad(day)}T00:00`, ASSOCIATION_TIMEZONE)
}

/** Noon on a Helsinki calendar day: an instant safely inside that day. */
function noonInTz({ year, month, day }: CalendarDay): Date {
  const pad = (n: number) => String(n).padStart(2, '0')
  return parseDatetimeLocal(`${year}-${pad(month)}-${pad(day)}T12:00`, ASSOCIATION_TIMEZONE)
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

/** Banking days after the due date an unpaid binding invoice has before its seats are released. */
export const SEAT_RELEASE_WORKING_DAYS = 3
/** Seats are never released this close to the event; unpaid invoices then stay as debt. */
export const SEAT_RELEASE_CUTOFF_DAYS = 2

/** A binding signup's invoice is due at the end of the day it is issued. */
export function bindingInvoiceDueDate(now: Date = new Date()): Date {
  return endOfDayInTz(now)
}

/**
 * The end of a binding invoice's payment window: the end of the
 * `SEAT_RELEASE_WORKING_DAYS`th Finnish banking day after the due date.
 * Signed up Monday -> end of Thursday; Friday -> end of Wednesday.
 */
export function bindingPaymentDeadline(dueDate: Date): Date {
  const { year, month, day } = getDatePartsInTz(dueDate)
  const last = addBankingDays({ year, month, day }, SEAT_RELEASE_WORKING_DAYS)
  return endOfDayInTz(noonInTz(last))
}

/**
 * When an unpaid binding invoice's seats are released: the end of its
 * payment window, or null when that would fall inside the cutoff before the
 * event (late signups are never released).
 */
export function seatReleaseDate(dueDate: Date, eventDate: Date): Date | null {
  const release = bindingPaymentDeadline(dueDate)
  const cutoff = endOfDayInTz(eventDate, -SEAT_RELEASE_CUTOFF_DAYS)
  return release <= cutoff ? release : null
}

/**
 * The payment reminder goes out on the last day of the payment window, in
 * the nightly run that day: `deadline` is the release date (or, for
 * invoices whose seats are never released, the payment deadline).
 */
export function isPaymentReminderDue(deadline: Date, now: Date = new Date()): boolean {
  return now >= startOfDayInTz(deadline) && now < deadline
}

/** The deadline a binding invoice's reminder is keyed to. */
export function paymentReminderDeadline(inv: { dueDate: Date; seatReleaseAt: Date | null }): Date {
  return inv.seatReleaseAt ?? bindingPaymentDeadline(inv.dueDate)
}
