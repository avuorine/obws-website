import { getPayload } from 'payload'
import { getLocale, getTranslations } from 'next-intl/server'
import { RichText } from '@payloadcms/richtext-lexical/react'

import config from '@/payload.config'
import { MembershipForm } from '@/components/MembershipForm'

export default async function MembershipPage() {
  const locale = await getLocale()
  const t = await getTranslations('membershipForm')

  const payload = await getPayload({ config })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const settings = await (payload as any).findGlobal({
    slug: 'site-settings',
    locale,
  })

  return (
    <div>
      <h1 className="mb-6 font-serif text-3xl font-bold">{t('title')}</h1>

      {settings.membershipIntro && (
        <div className="prose prose-whisky mb-8 max-w-none">
          <RichText data={settings.membershipIntro} />
        </div>
      )}

      <div className="mb-8 rounded-lg border border-border bg-parchment/50 p-6">
        <h2 className="mb-2 font-serif text-xl font-semibold text-whisky">
          {t('feeTitle')}
        </h2>
        <p className="mb-2 text-2xl font-bold text-amber">{t('feeAmount')}</p>
        <p className="text-sm text-whisky-light">{t('feeDescription')}</p>
      </div>

      <MembershipForm />
    </div>
  )
}
