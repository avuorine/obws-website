import Link from 'next/link'
import { getPayload } from 'payload'
import { getLocale, getTranslations } from 'next-intl/server'
import { RichText } from '@payloadcms/richtext-lexical/react'

import config from '@/payload.config'
import { Logo } from '@/components/Logo'

export default async function HomePage() {
  const locale = await getLocale()
  const t = await getTranslations('landing')

  const payload = await getPayload({ config })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const settings = await (payload as any).findGlobal({
    slug: 'site-settings',
    locale,
  })

  return (
    <div className="flex flex-col items-center">
      <div className="text-center">
        <Logo className="mx-auto mb-8" />

        <h1 className="mb-4 font-serif text-3xl font-bold md:text-4xl">
          {settings.associationName}
        </h1>

        {settings.tagline && (
          <p className="mb-8 text-lg text-whisky-light">{settings.tagline}</p>
        )}
      </div>

      <p className="mb-10 max-w-2xl text-center text-lg leading-relaxed text-whisky-light">
        {t('intro')}
      </p>

      <div className="mb-10 w-full max-w-xl">
        <h2 className="mb-4 text-center font-serif text-xl font-semibold">
          {t('activities')}
        </h2>
        <ul className="space-y-3 text-whisky-light">
          <li className="flex items-start gap-3">
            <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-amber" />
            {t('activitiesList.tastings')}
          </li>
          <li className="flex items-start gap-3">
            <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-amber" />
            {t('activitiesList.education')}
          </li>
          <li className="flex items-start gap-3">
            <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-amber" />
            {t('activitiesList.trips')}
          </li>
          <li className="flex items-start gap-3">
            <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-amber" />
            {t('activitiesList.events')}
          </li>
          <li className="flex items-start gap-3">
            <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-amber" />
            {t('activitiesList.collaboration')}
          </li>
        </ul>
      </div>

      {settings.landingContent && (
        <div className="prose prose-whisky mb-10 max-w-none text-left">
          <RichText data={settings.landingContent} />
        </div>
      )}

      <Link
        href="/membership"
        className="inline-block rounded-lg bg-amber px-8 py-3 font-medium text-white transition-colors hover:bg-amber/90"
      >
        {t('learnMore')}
      </Link>
    </div>
  )
}
