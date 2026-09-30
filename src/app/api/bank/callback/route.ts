import { NextResponse, type NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/admin-guard'
import { db } from '@/db'
import { bankAuthStates } from '@/db/schema'
import { and, eq, gt } from 'drizzle-orm'
import { createSession, EnableBankingError } from '@/lib/enablebanking'
import { pickAccount, saveConnection, toPendingAccounts } from '@/lib/bank-connection'
import { getSettings } from '@/lib/settings'

const PICK_TTL_MS = 15 * 60 * 1000

/**
 * The bank sends the admin back here after consent. The state must be one
 * this admin started in the last 15 minutes; it is consumed on use.
 */
export async function GET(request: NextRequest) {
  const admin = await requireAdmin()
  const params = request.nextUrl.searchParams
  const back = (query: string) =>
    NextResponse.redirect(new URL(`/members/admin/bank?${query}`, process.env.NEXT_PUBLIC_SITE_URL ?? request.url))

  const state = params.get('state') ?? ''
  const pending = await db
    .select()
    .from(bankAuthStates)
    .where(
      and(
        eq(bankAuthStates.state, state),
        eq(bankAuthStates.userId, admin.id),
        gt(bankAuthStates.expiresAt, new Date()),
      ),
    )
    .then((r) => r[0])
  if (!pending || pending.sessionId) return back('error=bankStateInvalid')

  if (params.get('error') || !params.get('code')) {
    await db.delete(bankAuthStates).where(eq(bankAuthStates.state, state))
    return back('error=bankAuthCancelled')
  }

  try {
    const session = await createSession(params.get('code')!)
    const accounts = toPendingAccounts(session.accounts)
    if (accounts.length === 0) {
      // Typical in restricted mode when the account wasn't linked in the control panel.
      await db.delete(bankAuthStates).where(eq(bankAuthStates.state, state))
      return back('error=bankNoAccounts')
    }

    const settings = await getSettings()
    const account = pickAccount(accounts, settings.iban)
    if (!account) {
      await db
        .update(bankAuthStates)
        .set({ sessionId: session.session_id, accounts, expiresAt: new Date(Date.now() + PICK_TTL_MS) })
        .where(eq(bankAuthStates.state, state))
      return back(`pick=${encodeURIComponent(state)}`)
    }

    await saveConnection({
      aspspName: pending.aspspName,
      aspspCountry: pending.aspspCountry,
      psuType: pending.psuType,
      sessionId: session.session_id,
      account,
      validUntil: pending.validUntil,
      userId: admin.id,
    })
    await db.delete(bankAuthStates).where(eq(bankAuthStates.state, state))
    return back('connected=1')
  } catch (error) {
    console.error('Bank session creation failed', error instanceof EnableBankingError ? error.message : error)
    await db.delete(bankAuthStates).where(eq(bankAuthStates.state, state))
    return back('error=bankProviderError')
  }
}
