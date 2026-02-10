'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { CheckIcon, ChevronsUpDownIcon } from 'lucide-react'
import { municipalities } from '@/data/municipalities'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'

type Props = {
  value: string
  onChange: (value: string) => void
  onBlur: () => void
  error?: string
  name: string
}

export function MunicipalitySelect({ value, onChange, onBlur, error }: Props) {
  const locale = useLocale()
  const t = useTranslations('membershipForm')
  const [open, setOpen] = useState(false)

  const displayName = (m: (typeof municipalities)[number]) => {
    const { fi, sv } = m
    if (locale === 'fi') return fi === sv ? fi : `${fi} (${sv})`
    if (locale === 'sv') return fi === sv ? sv : `${sv} (${fi})`
    return fi === sv ? fi : `${fi} / ${sv}`
  }

  const selectedMunicipality = value
    ? municipalities.find((m) => displayName(m) === value || m.fi === value || m.sv === value)
    : undefined
  const selectedLabel = selectedMunicipality ? displayName(selectedMunicipality) : value || undefined

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            'w-full justify-between font-normal',
            !value && 'text-muted-foreground',
            error && 'border-destructive',
          )}
          onClick={() => setOpen(true)}
          onBlur={onBlur}
        >
          {selectedLabel ?? t('municipalityPlaceholder')}
          <ChevronsUpDownIcon className="ml-auto h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder={t('municipalityPlaceholder')} />
          <CommandList>
            <CommandEmpty>—</CommandEmpty>
            <CommandGroup>
              {municipalities.map((m) => {
                const label = displayName(m)
                return (
                  <CommandItem
                    key={m.code}
                    value={label}
                    onSelect={() => {
                      onChange(label)
                      setOpen(false)
                    }}
                  >
                    <CheckIcon
                      className={cn(
                        'mr-2 h-4 w-4',
                        value === label ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                    {label}
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
