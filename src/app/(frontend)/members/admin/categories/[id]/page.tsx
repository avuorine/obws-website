import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { db } from '@/db'
import { eventCategories } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CategoryForm } from '@/components/admin/CategoryForm'
import { ArrowLeft } from 'lucide-react'

export default async function EditCategoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const t = await getTranslations('admin')

  const category = await db
    .select()
    .from(eventCategories)
    .where(eq(eventCategories.id, id))
    .then((r) => r[0])

  if (!category) notFound()

  return (
    <div>
      <Link
        href="/members/admin/categories"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('back')}
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>{t('editCategory')}</CardTitle>
        </CardHeader>
        <CardContent>
          <CategoryForm
            categoryId={id}
            defaultValues={{
              slug: category.slug,
              nameSv: category.nameLocales.sv ?? '',
              nameFi: category.nameLocales.fi ?? '',
              nameEn: category.nameLocales.en ?? '',
              sortOrder: String(category.sortOrder ?? 0),
            }}
          />
        </CardContent>
      </Card>
    </div>
  )
}
