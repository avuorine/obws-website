'use client'

import * as React from 'react'
import { useLocale } from 'next-intl'
import type { Locale } from 'date-fns'
import { sv, fi, enGB } from 'date-fns/locale'
import { CalendarIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

const DATE_FNS_LOCALES: Record<string, Locale> = {
  sv,
  fi,
  en: enGB,
}

// --- Locale-aware format / parse helpers ---

const DATE_FORMATS: Record<string, { pattern: string; separator: string }> = {
  sv: { pattern: 'YYYY-MM-DD', separator: '-' },
  fi: { pattern: 'DD.MM.YYYY', separator: '.' },
  en: { pattern: 'DD/MM/YYYY', separator: '/' },
}

/** Convert YYYY-MM-DD to locale display string */
function formatForLocale(dateStr: string, locale: string): string {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-')
  if (!y || !m || !d) return ''
  const fmt = DATE_FORMATS[locale] || DATE_FORMATS.sv
  if (locale === 'sv') return `${y}${fmt.separator}${m}${fmt.separator}${d}`
  return `${d}${fmt.separator}${m}${fmt.separator}${y}`
}

/** Parse locale display string back to YYYY-MM-DD, or null if invalid */
function parseFromLocale(text: string, locale: string): string | null {
  const trimmed = text.trim()
  if (!trimmed) return null
  const fmt = DATE_FORMATS[locale] || DATE_FORMATS.sv
  const parts = trimmed.split(fmt.separator)
  if (parts.length !== 3) return null

  let y: string, m: string, d: string
  if (locale === 'sv') {
    ;[y, m, d] = parts
  } else {
    ;[d, m, y] = parts
  }

  const year = parseInt(y, 10)
  const month = parseInt(m, 10)
  const day = parseInt(d, 10)

  if (isNaN(year) || isNaN(month) || isNaN(day)) return null
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  if (year < 1000 || year > 9999) return null

  // Validate the date actually exists (e.g. Feb 30 is invalid)
  const date = new Date(year, month - 1, day)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null
  }

  const ms = String(month).padStart(2, '0')
  const ds = String(day).padStart(2, '0')
  return `${year}-${ms}-${ds}`
}

// --- Date helpers ---

interface DatePickerProps {
  /** Date value as YYYY-MM-DD string */
  value?: string
  /** Called with YYYY-MM-DD string (or empty string to clear) */
  onChange?: (value: string) => void
  onBlur?: () => void
  placeholder?: string
  disabled?: boolean
  /** Disable all dates after this date */
  maxDate?: Date
  /** Disable all dates before this date */
  minDate?: Date
  /** First year in the year dropdown (default: currentYear - 100) */
  startYear?: number
  /** Last year in the year dropdown (default: currentYear + 5) */
  endYear?: number
  name?: string
}

function toDate(value?: string): Date | undefined {
  if (!value) return undefined
  const d = new Date(value + 'T00:00:00')
  return isNaN(d.getTime()) ? undefined : d
}

function toDateString(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const DatePicker = React.forwardRef<HTMLInputElement, DatePickerProps>(
  (
    {
      value,
      onChange,
      onBlur,
      placeholder,
      disabled,
      maxDate,
      minDate,
      startYear,
      endYear,
      name,
    },
    ref,
  ) => {
    const locale = useLocale()
    const dateFnsLocale = DATE_FNS_LOCALES[locale] || sv
    const [open, setOpen] = React.useState(false)

    const fmt = DATE_FORMATS[locale] || DATE_FORMATS.sv

    // Input text state — synced with external value prop
    const [inputValue, setInputValue] = React.useState(() =>
      value ? formatForLocale(value, locale) : '',
    )

    // Sync inputValue when value prop changes externally
    React.useEffect(() => {
      setInputValue(value ? formatForLocale(value, locale) : '')
    }, [value, locale])

    const selected = toDate(value)

    // Year range for dropdown
    const currentYear = new Date().getFullYear()
    const resolvedStartYear = startYear ?? currentYear - 100
    const resolvedEndYear = endYear ?? currentYear + 5

    // Compute startMonth / endMonth for the Calendar dropdown range
    const startMonth = minDate
      ? new Date(
          Math.max(minDate.getFullYear(), resolvedStartYear),
          minDate.getFullYear() >= resolvedStartYear ? minDate.getMonth() : 0,
          1,
        )
      : new Date(resolvedStartYear, 0, 1)

    const endMonthFromYear = new Date(resolvedEndYear, 11, 31)
    const endMonth = maxDate
      ? maxDate < endMonthFromYear
        ? maxDate
        : endMonthFromYear
      : endMonthFromYear

    // Default month: open the calendar at the selected date, or maxDate, or today
    const defaultMonth = selected ?? maxDate ?? new Date()

    // Disabled matcher combining minDate and maxDate
    const disabledMatcher: Array<{ before: Date } | { after: Date }> = []
    if (maxDate) disabledMatcher.push({ after: maxDate })
    if (minDate) disabledMatcher.push({ before: minDate })

    /** Validate and commit the typed input */
    const commitInput = () => {
      const trimmed = inputValue.trim()
      if (!trimmed) {
        // Allow clearing
        onChange?.('')
        return
      }

      const parsed = parseFromLocale(trimmed, locale)
      if (!parsed) {
        // Invalid — revert
        setInputValue(value ? formatForLocale(value, locale) : '')
        return
      }

      const parsedDate = toDate(parsed)
      if (!parsedDate) {
        setInputValue(value ? formatForLocale(value, locale) : '')
        return
      }

      // Check against min/max bounds
      if (maxDate && parsedDate > maxDate) {
        setInputValue(value ? formatForLocale(value, locale) : '')
        return
      }
      if (minDate && parsedDate < minDate) {
        setInputValue(value ? formatForLocale(value, locale) : '')
        return
      }

      onChange?.(parsed)
    }

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverAnchor asChild>
          <div className="relative">
            <input
              ref={ref}
              type="text"
              inputMode="numeric"
              disabled={disabled}
              placeholder={placeholder || fmt.pattern}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onBlur={() => {
                commitInput()
                onBlur?.()
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  commitInput()
                  setOpen(false)
                }
              }}
              className={cn(
                'flex h-10 w-full rounded-lg border border-input bg-transparent px-4 py-2 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground',
              )}
            />
            <PopoverTrigger asChild>
              <button
                type="button"
                disabled={disabled}
                tabIndex={-1}
                className="absolute inset-y-0 right-0 flex items-center px-2.5 text-muted-foreground hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
              >
                <CalendarIcon className="h-4 w-4" />
              </button>
            </PopoverTrigger>
          </div>
        </PopoverAnchor>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            captionLayout="dropdown"
            defaultMonth={defaultMonth}
            startMonth={startMonth}
            endMonth={endMonth}
            selected={selected}
            onSelect={(date) => {
              if (date) {
                onChange?.(toDateString(date))
              }
              setOpen(false)
              onBlur?.()
            }}
            disabled={disabledMatcher.length > 0 ? disabledMatcher : undefined}
            locale={dateFnsLocale}
          />
        </PopoverContent>
        {name && <input type="hidden" name={name} value={value || ''} />}
      </Popover>
    )
  },
)
DatePicker.displayName = 'DatePicker'

export { DatePicker }
