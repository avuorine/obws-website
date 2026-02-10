import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

import { Logo } from '@/components/Logo'
import { Button } from '@/components/ui/button'

export default async function HomePage() {
  const t = await getTranslations('landing')

  return (
    <div className="flex flex-col items-center">
      <div className="text-center">
        <Logo className="mx-auto mb-8" />

        <h1 className="mb-4 font-serif text-3xl font-bold md:text-4xl">
          {t('associationName')}
        </h1>

        <p className="mb-8 text-lg text-muted-foreground">{t('tagline')}</p>
      </div>

      <p className="mb-10 max-w-2xl text-center text-lg leading-relaxed text-muted-foreground">
        {t('intro')}
      </p>

      <div className="mb-10 w-full max-w-xl">
        <h2 className="mb-4 text-center font-serif text-xl font-semibold">
          {t('activities')}
        </h2>
        <ul className="space-y-3 text-muted-foreground">
          <li className="flex items-start gap-3">
            <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-primary" />
            {t('activitiesList.tastings')}
          </li>
          <li className="flex items-start gap-3">
            <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-primary" />
            {t('activitiesList.education')}
          </li>
          <li className="flex items-start gap-3">
            <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-primary" />
            {t('activitiesList.trips')}
          </li>
          <li className="flex items-start gap-3">
            <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-primary" />
            {t('activitiesList.events')}
          </li>
          <li className="flex items-start gap-3">
            <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-primary" />
            {t('activitiesList.collaboration')}
          </li>
        </ul>
      </div>

      <Button size="lg" asChild>
        <Link href="/membership">{t('learnMore')}</Link>
      </Button>
    </div>
  )
}
