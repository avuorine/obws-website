import { getTranslations } from 'next-intl/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default async function PrivacyPage() {
  const t = await getTranslations('privacy')

  const sections = ['1', '2', '3', '4', '5', '6', '7', '8'] as const

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-8 font-serif text-3xl font-bold">{t('title')}</h1>

      <div className="space-y-8">
        {sections.map((num) => (
          <Card key={num}>
            <CardHeader>
              <CardTitle>{t(`sections.${num}.title`)}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{t(`sections.${num}.content`)}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
