'use client'

import * as React from 'react'
import { useLocale } from 'next-intl'
import type { Locale } from 'date-fns'
import { sv, fi, enGB } from 'date-fns/locale'
import { CalendarIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/format-date'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

const DATE_FNS_LOCALES: Record<string, Locale> = {
  sv,
  fi,
  en: enGB,
}

interface DatePickerProps {
  /** Date value as YYYY-MM-DD string */
  value?: string
  /** Called with YYYY-MM-DD string */
  onChange?: (value: string) => void
  onBlur?: () => void
  placeholder?: string
  disabled?: boolean
  /** Disable all dates after this date */
  maxDate?: Date
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

const DatePicker = React.forwardRef<HTMLButtonElement, DatePickerProps>(
  ({ value, onChange, onBlur, placeholder, disabled, maxDate, name }, ref) => {
    const locale = useLocale()
    const dateFnsLocale = DATE_FNS_LOCALES[locale] || sv
    const [open, setOpen] = React.useState(false)
    const selected = toDate(value)

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            ref={ref}
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn(
              'w-full justify-start text-left font-normal',
              !value && 'text-muted-foreground',
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {value ? formatDate(selected, locale) : (placeholder || '—')}
            {name && <input type="hidden" name={name} value={value || ''} />}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            defaultMonth={selected ?? maxDate}
            selected={selected}
            onSelect={(date) => {
              if (date) {
                onChange?.(toDateString(date))
              }
              setOpen(false)
              onBlur?.()
            }}
            disabled={maxDate ? { after: maxDate } : undefined}
            locale={dateFnsLocale}
          />
        </PopoverContent>
      </Popover>
    )
  },
)
DatePicker.displayName = 'DatePicker'

export { DatePicker }
