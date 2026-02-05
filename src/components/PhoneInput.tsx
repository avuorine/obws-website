'use client'

import PhoneInputWithCountry from 'react-phone-number-input/react-hook-form'
import type { Control } from 'react-hook-form'
import type { E164Number } from 'libphonenumber-js'
import 'react-phone-number-input/style.css'

type Props = {
  control: Control<any>
  name: string
  error?: boolean
}

export function PhoneInput({ control, name, error }: Props) {
  return (
    <PhoneInputWithCountry
      name={name}
      control={control}
      defaultCountry="FI"
      international
      countryCallingCodeEditable={false}
      className={`phone-input w-full rounded-lg border px-4 py-2.5 text-whisky outline-none transition-colors focus-within:border-amber focus-within:ring-1 focus-within:ring-amber ${
        error ? 'border-red-400' : 'border-border'
      }`}
    />
  )
}

export type { E164Number }
