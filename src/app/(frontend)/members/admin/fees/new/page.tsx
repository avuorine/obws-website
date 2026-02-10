import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FeePeriodForm } from '@/components/admin/FeePeriodForm'
import { ArrowLeft } from 'lucide-react'

export default async function NewFeePeriodPage() {
  const t = await getTranslations('admin')

  return (
    <div>
      <Link
        href="/members/admin/fees"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('back')}
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>{t('createFeePeriod')}</CardTitle>
        </CardHeader>
        <CardContent>
          <FeePeriodForm />
        </CardContent>
      </Card>
    </div>
  )
}
