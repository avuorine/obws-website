import { getTranslations } from 'next-intl/server'

import { MembershipForm } from '@/components/MembershipForm'

export default async function MembershipPage() {
  const t = await getTranslations('membershipForm')

  return (
    <div>
      <h1 className="mb-6 font-serif text-3xl font-bold">{t('title')}</h1>

      <p className="mb-8 text-whisky-light">{t('membershipIntro')}</p>

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
