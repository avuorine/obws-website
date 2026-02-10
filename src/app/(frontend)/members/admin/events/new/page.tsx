import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { db } from '@/db'
import { eventCategories } from '@/db/schema'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EventForm } from '@/components/admin/EventForm'
import { ArrowLeft } from 'lucide-react'

export default async function NewEventPage() {
  const t = await getTranslations('admin')

  const categories = await db
    .select()
    .from(eventCategories)
    .orderBy(eventCategories.sortOrder)

  return (
    <div>
      <Link
        href="/members/admin/events"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('back')}
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>{t('createEvent')}</CardTitle>
        </CardHeader>
        <CardContent>
          <EventForm categories={categories} />
        </CardContent>
      </Card>
    </div>
  )
}
