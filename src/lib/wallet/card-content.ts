import type { MembershipCardData } from '@/lib/membership'
import sv from '@/i18n/dictionaries/sv.json'
import fi from '@/i18n/dictionaries/fi.json'
import en from '@/i18n/dictionaries/en.json'

const DICTS = { sv, fi, en } as const
type Locale = keyof typeof DICTS
const DEFAULT_LOCALE: Locale = 'sv'

export interface CardContent {
  title: string
  member: string
  memberNumber: string
  status: string
  statusValue: string
}

/**
 * Localized labels for a member's card, read directly from the dictionaries so
 * it works outside a next-intl request (Apple device callbacks, Google PATCH).
 * Defaults to the app's default locale since no per-member locale is stored.
 */
export function buildCardContent(card: MembershipCardData, locale: string = DEFAULT_LOCALE): CardContent {
  const dict = (DICTS[locale as Locale] ?? DICTS[DEFAULT_LOCALE]).membershipCard

  const statusValue = card.isHonorary
    ? dict.statusHonorary
    : card.status === 'inactive'
      ? dict.statusInactive
      : dict.statusActive

  return {
    title: dict.title,
    member: dict.member,
    memberNumber: dict.memberNumber,
    status: dict.status,
    statusValue,
  }
}
