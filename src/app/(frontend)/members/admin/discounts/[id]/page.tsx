import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { db } from '@/db'
import { memberDiscounts } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DiscountForm } from '@/components/admin/DiscountForm'
import { ArrowLeft } from 'lucide-react'
import { requireAdmin } from '@/lib/admin-guard'

export default async function EditDiscountPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const { id } = await params
  const t = await getTranslations('admin')

  const discount = await db
    .select()
    .from(memberDiscounts)
    .where(eq(memberDiscounts.id, id))
    .then((r) => r[0])

  if (!discount) notFound()

  return (
    <div>
      <Link
        href="/members/admin/discounts"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('back')}
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>{t('editDiscount')}</CardTitle>
        </CardHeader>
        <CardContent>
          <DiscountForm
            discountId={id}
            defaultValues={{
              nameSv: discount.nameLocales.sv ?? '',
              nameFi: discount.nameLocales.fi ?? '',
              nameEn: discount.nameLocales.en ?? '',
              offerSv: discount.offerLocales.sv ?? '',
              offerFi: discount.offerLocales.fi ?? '',
              offerEn: discount.offerLocales.en ?? '',
              detailsSv: discount.detailsLocales?.sv ?? '',
              detailsFi: discount.detailsLocales?.fi ?? '',
              detailsEn: discount.detailsLocales?.en ?? '',
              address: discount.address ?? '',
              url: discount.url ?? '',
              sortOrder: String(discount.sortOrder),
              active: discount.active,
            }}
          />
        </CardContent>
      </Card>
    </div>
  )
}
