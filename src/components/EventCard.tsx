import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { getLocalized } from '@/lib/localize'
import type { LocalizedText } from '@/db/schema'

interface EventCardProps {
  id: string
  titleLocales: LocalizedText
  summaryLocales: LocalizedText | null
  date: Date
  type: string
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
  type,
  capacity,
  registrationCount,
  locale,
  userStatus,
}: EventCardProps) {
  const t = useTranslations('events')
  const spotsLeft = capacity ? capacity - (registrationCount ?? 0) : null

  return (
    <Link
      href={`/members/events/${id}`}
      className="block rounded-lg border border-border p-5 transition-colors hover:border-amber"
    >
      <div className="mb-2 flex items-center gap-2">
        <span className="rounded bg-amber/10 px-2 py-0.5 text-xs font-medium text-amber">
          {t(type as 'tasting' | 'social' | 'trip' | 'meeting' | 'other')}
        </span>
        {userStatus === 'registered' && (
          <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
            {t('registered')}
          </span>
        )}
        {userStatus === 'waitlisted' && (
          <span className="rounded bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">
            {t('waitlisted')}
          </span>
        )}
      </div>

      <h3 className="mb-1 font-serif text-lg font-semibold">
        {getLocalized(titleLocales, locale)}
      </h3>

      {summaryLocales && (
        <p className="mb-2 text-sm text-whisky-light">
          {getLocalized(summaryLocales, locale)}
        </p>
      )}

      <div className="flex items-center gap-4 text-xs text-whisky-light">
        <span>
          {date.toLocaleDateString(locale, {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
          })}
        </span>
        {spotsLeft !== null && (
          <span>
            {spotsLeft > 0 ? t('spotsLeft', { count: spotsLeft }) : t('full')}
          </span>
        )}
      </div>
    </Link>
  )
}
