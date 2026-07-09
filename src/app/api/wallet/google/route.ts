import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { getMember } from '@/lib/auth-server'
import { getCardData } from '@/lib/membership'
import { signMemberToken } from '@/lib/membership-token'
import { getSettings } from '@/lib/settings'
import { ensureGenericClass, buildSaveUrl } from '@/lib/wallet/google'

export const runtime = 'nodejs'

export async function GET() {
  const member = await getMember()
  if (!member) return new Response('Unauthorized', { status: 401 })

  const t = await getTranslations('membershipCard')
  const card = getCardData(member)
  const settings = await getSettings()

  const token = signMemberToken({
    memberId: card.memberId,
    memberNumber: card.memberNumber,
  })

  const statusValue = card.isHonorary
    ? t('statusHonorary')
    : card.status === 'inactive'
      ? t('statusInactive')
      : t('statusActive')

  let saveUrl: string
  try {
    await ensureGenericClass()
    saveUrl = buildSaveUrl(card, token, {
      organizationName: settings.name,
      member: t('member'),
      status: t('status'),
      statusValue,
    })
  } catch (err) {
    console.error('Failed to build Google Wallet save URL', err)
    return new Response('Wallet pass unavailable', { status: 500 })
  }

  redirect(saveUrl)
}
