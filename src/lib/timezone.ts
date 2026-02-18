/**
 * Association-wide timezone constant and utilities.
 *
 * All events happen in Finland, so we use a single timezone for
 * parsing datetime-local inputs and formatting dates. This handles
 * DST transitions correctly via the Intl API.
 */

export const ASSOCIATION_TIMEZONE = 'Europe/Helsinki'

/**
 * Get the UTC offset (in minutes) for a given instant in the association timezone.
 * Positive = ahead of UTC (e.g. +120 for EET, +180 for EEST).
 */
function getTimezoneOffsetMinutes(date: Date, timeZone: string): number {
  // Format the date parts in the target timezone
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date)

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)!.value)

  const year = get('year')
  const month = get('month')
  const day = get('day')
  let hour = get('hour')
  if (hour === 24) hour = 0 // midnight edge case
  const minute = get('minute')
  const second = get('second')

  // Build a UTC date from the wall-clock parts
  const wallAsUtc = Date.UTC(year, month - 1, day, hour, minute, second)
  // The difference between the wall-clock-as-UTC and the actual UTC instant
  // gives us the offset
  return Math.round((wallAsUtc - date.getTime()) / 60000)
}

/**
 * Parse a `datetime-local` input string (e.g. "2026-03-15T18:00") as
 * wall-clock time in the given timezone, returning a correct UTC Date.
 *
 * This is DST-aware: "2026-03-29T03:30" in Europe/Helsinki during the
 * spring-forward gap will resolve to the correct UTC instant.
 */
export function parseDatetimeLocal(
  str: string,
  timeZone: string = ASSOCIATION_TIMEZONE,
): Date {
  // Parse the components from the string
  const [datePart, timePart = '00:00'] = str.split('T')
  const [year, month, day] = datePart.split('-').map(Number)
  const [hour, minute] = timePart.split(':').map(Number)

  // First approximation: assume the date is in UTC, then adjust
  const approx = new Date(Date.UTC(year, month - 1, day, hour, minute))

  // Get the offset at this approximate instant
  const offsetMin = getTimezoneOffsetMinutes(approx, timeZone)

  // Adjust: if wall clock is offsetMin ahead of UTC, then
  // UTC = wall_clock - offset
  const adjusted = new Date(Date.UTC(year, month - 1, day, hour - Math.floor(offsetMin / 60), minute - (offsetMin % 60)))

  // Verify: the offset might differ at the adjusted time (DST boundary)
  const verifyOffset = getTimezoneOffsetMinutes(adjusted, timeZone)
  if (verifyOffset !== offsetMin) {
    return new Date(Date.UTC(year, month - 1, day, hour - Math.floor(verifyOffset / 60), minute - (verifyOffset % 60)))
  }

  return adjusted
}

/**
 * Convert a UTC Date to a "YYYY-MM-DDTHH:mm" string in the given timezone.
 * Used to populate `<input type="datetime-local">` default values.
 */
export function toDatetimeLocalString(
  date: Date | null | undefined,
  timeZone: string = ASSOCIATION_TIMEZONE,
): string {
  if (!date) return ''

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date)

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)!.value

  let hour = get('hour')
  if (hour === '24') hour = '00'

  return `${get('year')}-${get('month')}-${get('day')}T${hour}:${get('minute')}`
}

/**
 * Extract date parts (year, month, day) from a Date in the association timezone.
 * Useful for comparisons like same-day checks or month grouping.
 */
export function getDatePartsInTz(
  date: Date,
  timeZone: string = ASSOCIATION_TIMEZONE,
): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)!.value)

  return { year: get('year'), month: get('month'), day: get('day') }
}

/**
 * Format date parts for virtual barcode YYMMDD using association timezone.
 */
export function formatBarcodeDateInTz(
  date: Date,
  timeZone: string = ASSOCIATION_TIMEZONE,
): { yy: string; mm: string; dd: string } {
  const { year, month, day } = getDatePartsInTz(date, timeZone)
  return {
    yy: String(year).slice(-2),
    mm: String(month).padStart(2, '0'),
    dd: String(day).padStart(2, '0'),
  }
}
