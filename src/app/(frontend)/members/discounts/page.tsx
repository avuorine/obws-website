import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getTranslations, getLocale } from 'next-intl/server'
import { ExternalLink, MapPin } from 'lucide-react'
import { getMember } from '@/lib/auth-server'
import { getCardData } from '@/lib/membership'
import { getLocalized } from '@/lib/localize'
import { db } from '@/db'
import { memberDiscounts } from '@/db/schema'
import { asc, eq } from 'drizzle-orm'
import { Card, CardContent } from '@/components/ui/card'

export default async function MemberDiscountsPage() {
  const member = await getMember()
  if (!member) redirect('/login')

  const t = await getTranslations('discounts')
  const locale = await getLocale()

  // Same rule as the membership card: only active and honorary members.
  if (!getCardData(member).isValid) {
    return (
      <div>
        <h1 className="mb-6 font-serif text-3xl font-bold">{t('title')}</h1>
        <p className="max-w-md rounded-md border border-amber/40 bg-amber/10 p-3 text-sm text-whisky-light">
          {t('requiresValidCard')}
        </p>
      </div>
    )
  }

  const discounts = await db
    .select()
    .from(memberDiscounts)
    .where(eq(memberDiscounts.active, true))
    .orderBy(asc(memberDiscounts.sortOrder), asc(memberDiscounts.createdAt))

  return (
    <div>
      <h1 className="mb-2 font-serif text-3xl font-bold">{t('title')}</h1>
      <p className="mb-6 text-muted-foreground">
        {t('intro')}{' '}
        <Link href="/members/card" className="font-medium text-primary hover:underline">
          {t('showCard')}
        </Link>
      </p>

      {discounts.length === 0 ? (
        <p className="text-muted-foreground">{t('empty')}</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {discounts.map((d) => {
            const details = d.detailsLocales ? getLocalized(d.detailsLocales, locale) : ''
            return (
              <li key={d.id}>
                <Card className="h-full">
                  <CardContent className="flex h-full flex-col gap-3 p-5">
                    <h2 className="font-serif text-lg font-semibold">{getLocalized(d.nameLocales, locale)}</h2>
                    <p className="text-xl font-bold text-primary">{getLocalized(d.offerLocales, locale)}</p>
                    {details && <p className="text-sm text-muted-foreground">{details}</p>}
                    <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1 pt-2 text-sm">
                      {d.address && (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(d.address)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                        >
                          <MapPin className="h-4 w-4" />
                          {d.address}
                        </a>
                      )}
                      {d.url && (
                        <a
                          href={d.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                        >
                          <ExternalLink className="h-4 w-4" />
                          {t('website')}
                        </a>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
