import { getRequestConfig } from 'next-intl/server'
import { cookies, headers } from 'next/headers'

const SUPPORTED_LOCALES = ['sv', 'fi', 'en'] as const
const DEFAULT_LOCALE = 'sv'

function parseAcceptLanguage(header: string): string | undefined {
  const langs = header
    .split(',')
    .map((part) => {
      const [lang, q] = part.trim().split(';q=')
      return { lang: lang.trim().split('-')[0], q: q ? parseFloat(q) : 1 }
    })
    .sort((a, b) => b.q - a.q)

  for (const { lang } of langs) {
    if (SUPPORTED_LOCALES.includes(lang as (typeof SUPPORTED_LOCALES)[number])) {
      return lang
    }
  }
  return undefined
}

export default getRequestConfig(async () => {
  const cookieStore = await cookies()
  const headerStore = await headers()

  let locale: string = DEFAULT_LOCALE

  const cookieLocale = cookieStore.get('locale')?.value
  if (cookieLocale && SUPPORTED_LOCALES.includes(cookieLocale as (typeof SUPPORTED_LOCALES)[number])) {
    locale = cookieLocale
  } else {
    const acceptLang = headerStore.get('accept-language')
    if (acceptLang) {
      locale = parseAcceptLanguage(acceptLang) ?? DEFAULT_LOCALE
    }
  }

  return {
    locale,
    messages: (await import(`./dictionaries/${locale}.json`)).default,
  }
})
