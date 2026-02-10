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
      className={`phone-input flex h-10 w-full rounded-lg border bg-transparent px-4 py-2 text-sm text-foreground outline-none transition-colors focus-within:border-ring focus-within:ring-1 focus-within:ring-ring ${
        error ? 'border-destructive' : 'border-input'
      }`}
    />
  )
}

export type { E164Number }
