import { getLocale } from 'next-intl/server'
import { getMember } from '@/lib/auth-server'
import { getCardData } from '@/lib/membership'
import { buildApplePassForMember } from '@/lib/wallet/apple'

export const runtime = 'nodejs'

export async function GET() {
  const member = await getMember()
  if (!member) return new Response('Unauthorized', { status: 401 })

  const card = getCardData(member)
  const locale = await getLocale()

  try {
    const buffer = await buildApplePassForMember(card, locale)

    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.apple.pkpass',
        'Content-Disposition': 'attachment; filename="obws-membership.pkpass"',
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('Failed to build Apple Wallet pass', err)
    return new Response('Wallet pass unavailable', { status: 500 })
  }
}
