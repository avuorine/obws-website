import Link from 'next/link'
import { getTranslations, getLocale } from 'next-intl/server'
import { db } from '@/db'
import { eventCategories } from '@/db/schema'
import { getLocalized } from '@/lib/localize'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export default async function AdminCategoriesPage() {
  const t = await getTranslations('admin')
  const locale = await getLocale()

  const categories = await db
    .select()
    .from(eventCategories)
    .orderBy(eventCategories.sortOrder)

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-serif text-3xl font-bold">{t('categories')}</h1>
        <Button asChild>
          <Link href="/members/admin/categories/new">{t('addCategory')}</Link>
        </Button>
      </div>

      {categories.length === 0 ? (
        <p className="text-muted-foreground">{t('noCategories')}</p>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-input text-left">
                    <th className="px-4 py-3 font-medium">{t('slug')}</th>
                    <th className="px-4 py-3 font-medium">{t('name')}</th>
                    <th className="px-4 py-3 font-medium">{t('sortOrder')}</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map((cat) => (
                    <tr key={cat.id} className="border-b border-input last:border-0">
                      <td className="px-4 py-3">
                        <Link
                          href={`/members/admin/categories/${cat.id}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {cat.slug}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {getLocalized(cat.nameLocales, locale)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{cat.sortOrder}</td>
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
