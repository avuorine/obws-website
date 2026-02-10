import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { getLocalized } from '@/lib/localize'
import { formatDateShort } from '@/lib/format-date'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import type { LocalizedText } from '@/db/schema'

interface EventCardProps {
  id: string
  titleLocales: LocalizedText
  summaryLocales: LocalizedText | null
  date: Date
  categoryName: string
  capacity: number | null
  registrationCount: number | null
  locale: string
  userStatus?: string | null
}

export function EventCard({
  id,
  titleLocales,
  summaryLocales,
  date,
  categoryName,
  capacity,
  registrationCount,
  locale,
  userStatus,
}: EventCardProps) {
  const t = useTranslations('events')
  const spotsLeft = capacity ? capacity - (registrationCount ?? 0) : null

  return (
    <Link href={`/members/events/${id}`} className="block">
      <Card className="transition-colors hover:border-primary">
        <CardContent className="relative p-5">
          {(userStatus === 'registered' || userStatus === 'waitlisted' || categoryName) && (
            <div className="absolute right-5 top-5 flex items-center gap-2">
              {userStatus === 'registered' && <Badge variant="success">{t('registered')}</Badge>}
              {userStatus === 'waitlisted' && <Badge variant="warning">{t('waitlisted')}</Badge>}
              {categoryName && <Badge>{categoryName}</Badge>}
            </div>
          )}

          <h3 className="mb-1 pr-24 font-serif text-lg font-semibold">
            {getLocalized(titleLocales, locale)}
          </h3>

          {summaryLocales && (
            <p className="mb-2 text-sm text-muted-foreground">
              {getLocalized(summaryLocales, locale)}
            </p>
          )}

          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>{formatDateShort(date, locale)}</span>
            {spotsLeft !== null && (
              <span>
                {spotsLeft > 0 ? t('spotsLeft', { count: spotsLeft }) : t('full')}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
