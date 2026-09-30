import Link from 'next/link'
import { getTranslations, getLocale } from 'next-intl/server'
import { db } from '@/db'
import { memberDiscounts } from '@/db/schema'
import { asc } from 'drizzle-orm'
import { getLocalized } from '@/lib/localize'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { requireAdmin } from '@/lib/admin-guard'

export default async function AdminDiscountsPage() {
  await requireAdmin()
  const t = await getTranslations('admin')
  const locale = await getLocale()

  const discounts = await db
    .select()
    .from(memberDiscounts)
    .orderBy(asc(memberDiscounts.sortOrder), asc(memberDiscounts.createdAt))

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-serif text-3xl font-bold">{t('discounts')}</h1>
        <Button asChild>
          <Link href="/members/admin/discounts/new">{t('addDiscount')}</Link>
        </Button>
      </div>

      {discounts.length === 0 ? (
        <p className="text-muted-foreground">{t('noDiscounts')}</p>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="data-table w-full text-sm">
                <thead>
                  <tr className="border-b border-input text-left">
                    <th className="px-4 py-3 font-medium">{t('discountName')}</th>
                    <th className="px-4 py-3 font-medium">{t('discountOffer')}</th>
                    <th className="px-4 py-3 font-medium">{t('status')}</th>
                    <th className="px-4 py-3 font-medium">{t('sortOrder')}</th>
                  </tr>
                </thead>
                <tbody>
                  {discounts.map((d) => (
                    <tr key={d.id} className="border-b border-input last:border-0">
                      <td className="px-4 py-3">
                        <Link href={`/members/admin/discounts/${d.id}`} className="font-medium text-primary hover:underline">
                          {getLocalized(d.nameLocales, locale)}
                        </Link>
                      </td>
                      <td className="min-w-48 whitespace-normal px-4 py-3 text-muted-foreground">
                        {getLocalized(d.offerLocales, locale)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={d.active ? 'success' : 'outline'}>
                          {d.active ? t('discountVisible') : t('discountHidden')}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{d.sortOrder}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
