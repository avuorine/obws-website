/**
 * Finnish banking days: Monday to Friday, excluding the days Finnish banks
 * do not process payments (pankkivapaapäivät). Dates are calendar days,
 * represented as UTC-midnight Date objects so arithmetic is DST-free.
 */

export interface CalendarDay {
  year: number
  month: number // 1-12
  day: number
}

const toUtc = ({ year, month, day }: CalendarDay) => new Date(Date.UTC(year, month - 1, day))
const fromUtc = (d: Date): CalendarDay => ({
  year: d.getUTCFullYear(),
  month: d.getUTCMonth() + 1,
  day: d.getUTCDate(),
})

/** Easter Sunday (Gregorian), anonymous algorithm. */
export function easterSunday(year: number): CalendarDay {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return { year, month, day }
}

const holidayCache = new Map<number, Set<string>>()
const key = (d: CalendarDay) => `${d.year}-${d.month}-${d.day}`

/** Bank holidays that can fall on a weekday. */
function bankHolidays(year: number): Set<string> {
  const cached = holidayCache.get(year)
  if (cached) return cached

  const easter = toUtc(easterSunday(year))
  const offset = (days: number) => fromUtc(new Date(easter.getTime() + days * 86_400_000))
  // Midsummer Eve: the Friday between 19 and 25 June.
  const june19 = new Date(Date.UTC(year, 5, 19))
  const midsummerEve = fromUtc(new Date(june19.getTime() + ((5 - june19.getUTCDay() + 7) % 7) * 86_400_000))

  const days: CalendarDay[] = [
    { year, month: 1, day: 1 }, // New Year's Day
    { year, month: 1, day: 6 }, // Epiphany
    offset(-2), // Good Friday
    offset(1), // Easter Monday
    { year, month: 5, day: 1 }, // May Day
    offset(39), // Ascension Day
    midsummerEve,
    { year, month: 12, day: 6 }, // Independence Day
    { year, month: 12, day: 24 }, // Christmas Eve
    { year, month: 12, day: 25 }, // Christmas Day
    { year, month: 12, day: 26 }, // Boxing Day
  ]
  const set = new Set(days.map(key))
  holidayCache.set(year, set)
  return set
}

export function isBankingDay(day: CalendarDay): boolean {
  const weekday = toUtc(day).getUTCDay()
  if (weekday === 0 || weekday === 6) return false
  return !bankHolidays(day.year).has(key(day))
}

/** The `n`th banking day after `from` (not counting `from` itself). */
export function addBankingDays(from: CalendarDay, n: number): CalendarDay {
  let d = toUtc(from)
  let counted = 0
  while (counted < n) {
    d = new Date(d.getTime() + 86_400_000)
    if (isBankingDay(fromUtc(d))) counted++
  }
  return fromUtc(d)
}
