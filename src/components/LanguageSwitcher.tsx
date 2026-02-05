'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'

const locales = [
  { code: 'sv', label: 'SV' },
  { code: 'fi', label: 'FI' },
  { code: 'en', label: 'EN' },
] as const

export function LanguageSwitcher() {
  const currentLocale = useLocale()
  const router = useRouter()
  const t = useTranslations('common')
  const [isPending, startTransition] = useTransition()

  function switchLocale(locale: string) {
    document.cookie = `locale=${locale};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`
    startTransition(() => {
      router.refresh()
    })
  }

  return (
    <div className="flex items-center gap-1" role="group" aria-label={t('language')}>
      {locales.map(({ code, label }) => (
        <button
          key={code}
          onClick={() => switchLocale(code)}
          disabled={isPending}
          className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
            currentLocale === code
              ? 'bg-amber text-white'
              : 'text-whisky-light hover:bg-amber/10 hover:text-amber'
          }`}
          aria-current={currentLocale === code ? 'true' : undefined}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
