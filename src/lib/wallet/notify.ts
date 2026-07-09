import { db } from '@/db'
import { user, walletPassRegistrations } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { getCardData } from '@/lib/membership'
import { signMemberToken } from '@/lib/membership-token'
import { getSettings } from '@/lib/settings'
import { buildCardContent } from './card-content'
import { patchGenericObject } from './google'
import { sendPassUpdate } from './apple-apns'
import { bumpWalletPass } from './apple-webservice'

/**
 * Propagates a member's status change to their installed wallet passes:
 * Google cards auto-refresh via PATCH; Apple devices get an APNs push that
 * makes them pull a fresh pass from the web service.
 *
 * Best-effort: every external call is isolated so a failure never breaks the
 * admin action that triggered it.
 */
export async function notifyMembershipChanged(userId: string): Promise<void> {
  const [member] = await db.select().from(user).where(eq(user.id, userId)).limit(1)
  if (!member) return

  const card = getCardData(member)
  const token = signMemberToken({ memberId: card.memberId, memberNumber: card.memberNumber })

  // Mark the pass as changed so registered Apple devices pull a new copy.
  try {
    await bumpWalletPass(card.memberId)
  } catch (err) {
    console.error('Failed to bump wallet pass tag', err)
  }

  // Google: update the saved object (no-op if the member never saved it).
  try {
    const settings = await getSettings()
    const content = buildCardContent(card)
    await patchGenericObject(card, token, {
      organizationName: settings.name,
      member: content.member,
      status: content.status,
      statusValue: content.statusValue,
    })
  } catch (err) {
    console.error('Failed to patch Google Wallet object', err)
  }

  // Apple: push every registered device for this pass.
  try {
    const regs = await db
      .select({ pushToken: walletPassRegistrations.pushToken })
      .from(walletPassRegistrations)
      .where(eq(walletPassRegistrations.serialNumber, card.memberId))
    if (regs.length > 0) {
      await sendPassUpdate(regs.map((r) => r.pushToken))
    }
  } catch (err) {
    console.error('Failed to push Apple Wallet update', err)
  }
}
