'use client'

import { useLocale, useTranslations } from 'next-intl'
import { municipalities } from '@/data/municipalities'

type Props = {
  value: string
  onChange: (value: string) => void
  onBlur: () => void
  error?: string
  name: string
}

export function MunicipalitySelect({ value, onChange, onBlur, error, name }: Props) {
  const locale = useLocale()
  const t = useTranslations('membershipForm')
  const listId = `${name}-list`

  const displayName = (m: (typeof municipalities)[number]) => {
    const fi = m.fi
    const sv = m.sv
    if (locale === 'fi') return fi === sv ? fi : `${fi} (${sv})`
    if (locale === 'sv') return fi === sv ? sv : `${sv} (${fi})`
    return fi === sv ? fi : `${fi} / ${sv}`
  }

  return (
    <div>
      <input
        type="text"
        name={name}
        list={listId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={t('municipalityPlaceholder')}
        autoComplete="off"
        className={`w-full rounded-lg border px-4 py-2.5 text-whisky outline-none transition-colors placeholder:text-whisky-light/50 focus:border-amber focus:ring-1 focus:ring-amber ${
          error ? 'border-red-400' : 'border-border'
        }`}
      />
      <datalist id={listId}>
        {municipalities.map((m) => (
          <option key={m.code} value={displayName(m)} />
        ))}
      </datalist>
    </div>
  )
}
