import { ASSOCIATION_TIMEZONE } from './timezone'

const LOCALE_MAP: Record<string, string> = {
  sv: 'sv-SE',
  fi: 'fi-FI',
  en: 'en-GB',
}

function toFullLocale(locale: string): string {
  return LOCALE_MAP[locale] || locale
}

/**
 * Format a date using the user's active locale.
 * Returns '—' for null/undefined/invalid dates.
 */
export function formatDate(
  date: Date | string | null | undefined,
  locale: string,
  options?: Intl.DateTimeFormatOptions,
): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(toFullLocale(locale), { timeZone: ASSOCIATION_TIMEZONE, ...options })
}

/** e.g. "lö 8 feb" / "la 8. helmik." / "Sat 8 Feb" */
export function formatDateShort(date: Date | string | null | undefined, locale: string): string {
  return formatDate(date, locale, { weekday: 'short', month: 'short', day: 'numeric' })
}

/** e.g. "lördag 8 februari 2026" */
export function formatDateLong(date: Date | string | null | undefined, locale: string): string {
  return formatDate(date, locale, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

const TIME_PREFIX: Record<string, string> = {
  sv: 'kl',
  fi: 'klo',
  en: 'at',
}

function toDate(date: Date | string): Date {
  return typeof date === 'string' ? new Date(date) : date
}

/** e.g. "kl 15:00" / "klo 15:00" / "at 15:00" */
export function formatTime(date: Date | string | null | undefined, locale: string): string {
  if (!date) return '—'
  const d = toDate(date)
  if (isNaN(d.getTime())) return '—'
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: ASSOCIATION_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d)
  const hh = parts.find((p) => p.type === 'hour')!.value.replace('24', '00')
  const mm = parts.find((p) => p.type === 'minute')!.value
  const prefix = TIME_PREFIX[locale] || 'at'
  return `${prefix} ${hh}:${mm}`
}

/** e.g. "27.10.2026 kl 15:00 (fredag)" */
export function formatDateTime(date: Date | string | null | undefined, locale: string): string {
  if (!date) return '—'
  const d = toDate(date)
  if (isNaN(d.getTime())) return '—'
  const dateParts = new Intl.DateTimeFormat('en-US', {
    timeZone: ASSOCIATION_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d)
  const get = (type: Intl.DateTimeFormatPartTypes) => dateParts.find((p) => p.type === type)!.value
  const dd = get('day')
  const mo = get('month')
  const yyyy = get('year')
  const hh = get('hour').replace('24', '00')
  const mm = get('minute')
  const weekday = d.toLocaleDateString(toFullLocale(locale), { weekday: 'long', timeZone: ASSOCIATION_TIMEZONE })
  const prefix = TIME_PREFIX[locale] || 'at'
  return `${dd}.${mo}.${yyyy} ${prefix} ${hh}:${mm} (${weekday})`
}

/** e.g. "februari 2026" */
export function formatMonthYear(date: Date | string | null | undefined, locale: string): string {
  return formatDate(date, locale, { month: 'long', year: 'numeric' })
}
