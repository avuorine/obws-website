import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DiscountForm } from '@/components/admin/DiscountForm'
import { ArrowLeft } from 'lucide-react'
import { requireAdmin } from '@/lib/admin-guard'

export default async function NewDiscountPage() {
  await requireAdmin()
  const t = await getTranslations('admin')

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
          <CardTitle>{t('addDiscount')}</CardTitle>
        </CardHeader>
        <CardContent>
          <DiscountForm />
        </CardContent>
      </Card>
    </div>
  )
}
