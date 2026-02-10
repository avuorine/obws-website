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
  return d.toLocaleDateString(toFullLocale(locale), options)
}

/** e.g. "lö 8 feb" / "la 8. helmik." / "Sat 8 Feb" */
export function formatDateShort(date: Date | string | null | undefined, locale: string): string {
  return formatDate(date, locale, { weekday: 'short', month: 'short', day: 'numeric' })
}

/** e.g. "lördag 8 februari 2026" */
export function formatDateLong(date: Date | string | null | undefined, locale: string): string {
  return formatDate(date, locale, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

/** e.g. "februari 2026" */
export function formatMonthYear(date: Date | string | null | undefined, locale: string): string {
  return formatDate(date, locale, { month: 'long', year: 'numeric' })
}
