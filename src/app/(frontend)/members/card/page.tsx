import { redirect } from 'next/navigation'
import { getTranslations, getLocale } from 'next-intl/server'
import QRCode from 'qrcode'
import { getMember } from '@/lib/auth-server'
import { getCardData } from '@/lib/membership'
import { signMemberToken } from '@/lib/membership-token'
import { getSettings } from '@/lib/settings'
import { formatDate } from '@/lib/format-date'
import { MembershipCard } from '@/components/MembershipCard'
import { WalletButtons } from '@/components/WalletButtons'

export default async function MembershipCardPage() {
  const member = await getMember()
  if (!member) redirect('/login')

  const t = await getTranslations('membershipCard')
  const locale = await getLocale()

  const card = getCardData(member)
  const settings = await getSettings()

  const token = signMemberToken({
    memberId: card.memberId,
    memberNumber: card.memberNumber,
  })
  const qrDataUrl = await QRCode.toDataURL(token, { margin: 0, width: 192 })

  const statusLabel = card.isHonorary
    ? t('statusHonorary')
    : card.status === 'inactive'
      ? t('statusInactive')
      : t('statusActive')

  return (
    <div>
      <h1 className="mb-6 font-serif text-3xl font-bold">{t('title')}</h1>

      <MembershipCard
        associationName={settings.name}
        fullName={card.fullName}
        memberNumber={card.memberNumber}
        statusLabel={statusLabel}
        memberLabel={t('member')}
        statusFieldLabel={t('status')}
        memberSinceLabel={t('memberSince')}
        memberSinceValue={card.memberSince ? formatDate(card.memberSince, locale) : ''}
        isValid={card.isValid}
        qrDataUrl={qrDataUrl}
      />

      {!card.isValid && (
        <p className="mt-4 max-w-md rounded-md border border-amber/40 bg-amber/10 p-3 text-sm text-whisky-light">
          {t('inactiveNotice')}
        </p>
      )}

      <div className="mt-6">
        <WalletButtons appleLabel={t('addToApple')} googleLabel={t('addToGoogle')} />
        <p className="mt-3 max-w-md text-sm text-muted-foreground">{t('qrHelp')}</p>
      </div>
    </div>
  )
}
