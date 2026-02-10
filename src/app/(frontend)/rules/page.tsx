import { getTranslations } from 'next-intl/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default async function RulesPage() {
  const t = await getTranslations('rules')

  const sections = [
    '1',
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
    '8',
    '9',
    '10',
    '11',
  ] as const

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

              {t.has(`sections.${num}.activities`) && (
                <>
                  <p className="mt-4 font-medium">
                    {t(`sections.${num}.activities`)}
                  </p>
                  <ul className="mt-2 list-inside list-disc space-y-1 text-muted-foreground">
                    {(t.raw(`sections.${num}.activityList`) as string[]).map(
                      (item, i) => (
                        <li key={i}>{item}</li>
                      ),
                    )}
                  </ul>
                </>
              )}

              {t.has(`sections.${num}.support`) && (
                <>
                  <p className="mt-4 font-medium">
                    {t(`sections.${num}.support`)}
                  </p>
                  <ul className="mt-2 list-inside list-disc space-y-1 text-muted-foreground">
                    {(t.raw(`sections.${num}.supportList`) as string[]).map(
                      (item, i) => (
                        <li key={i}>{item}</li>
                      ),
                    )}
                  </ul>
                </>
              )}

              {t.has(`sections.${num}.items`) && (
                <ol className="mt-2 list-inside list-decimal space-y-1 text-muted-foreground">
                  {(t.raw(`sections.${num}.items`) as string[]).map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ol>
              )}

              {t.has(`sections.${num}.note`) && (
                <p className="mt-4 text-sm italic text-muted-foreground">
                  {t(`sections.${num}.note`)}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
