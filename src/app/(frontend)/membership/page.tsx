import { getTranslations } from 'next-intl/server'
import { BotIdClient } from 'botid/client'

import { MembershipForm } from '@/components/MembershipForm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default async function MembershipPage() {
  const t = await getTranslations('membershipForm')

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-6 font-serif text-3xl font-bold">{t('title')}</h1>

      <p className="mb-8 text-muted-foreground">{t('membershipIntro')}</p>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>{t('feeTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-2 text-2xl font-bold text-primary">{t('feeAmount')}</p>
          <p className="text-sm text-muted-foreground">{t('feeDescription')}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t('ageRequirement')}</p>
        </CardContent>
      </Card>

      <BotIdClient protect={[{ path: '/membership', method: 'POST' }]} />
      <MembershipForm />
    </div>
  )
}
