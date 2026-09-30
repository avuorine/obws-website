'use server'

import { randomBytes } from 'crypto'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/admin-guard'
import { db } from '@/db'
import { bankAuthStates, bankConnections } from '@/db/schema'
import { and, eq, gt } from 'drizzle-orm'
import { consentValidUntil, deleteSession, isConfigured, listAspsps, startAuth, EnableBankingError } from '@/lib/enablebanking'
import { currentConnection, saveConnection } from '@/lib/bank-connection'
import { syncBankConnection } from '@/lib/bank-sync'

const STATE_TTL_MS = 15 * 60 * 1000
const SYNC_NOW_INTERVAL_MS = 30 * 60 * 1000

/**
 * Start the bank consent flow and redirect to the bank. Redirecting from the
 * action (instead of returning the URL for the client to navigate to) stops
 * Next from re-rendering this page first: the admin check refreshes the
 * session cookie, and a cookie write in an action triggers a page refresh
 * that would otherwise race the navigation and flash an error.
 */
export async function startBankConnection(
  aspspName: string,
  aspspCountry: string,
  psuType: 'business' | 'personal',
): Promise<{ error?: string }> {
  const admin = await requireAdmin()
  if (!isConfigured()) return { error: 'bankNotConfigured' }

  let bankUrl: string
  try {
    const aspsp = (await listAspsps(aspspCountry)).find((a) => a.name === aspspName)
    if (!aspsp) return { error: 'bankNotFound' }

    const state = randomBytes(32).toString('base64url')
    const validUntil = consentValidUntil(aspsp)
    await db.insert(bankAuthStates).values({
      state,
      userId: admin.id,
      aspspName,
      aspspCountry,
      psuType,
      validUntil,
      expiresAt: new Date(Date.now() + STATE_TTL_MS),
    })

    const { url } = await startAuth({
      aspspName,
      aspspCountry,
      psuType,
      validUntil,
      state,
      redirectUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/api/bank/callback`,
    })
    bankUrl = url
  } catch (error) {
    console.error('Bank auth start failed', error instanceof EnableBankingError ? error.message : error)
    return { error: 'bankProviderError' }
  }
  // Outside the try: redirect() works by throwing.
  redirect(bankUrl)
}

/** Finish a connection when the bank returned several accounts. */
export async function chooseBankAccount(state: string, accountUid: string): Promise<{ success: boolean; error?: string }> {
  const admin = await requireAdmin()

  const pending = await db
    .select()
    .from(bankAuthStates)
    .where(and(eq(bankAuthStates.state, state), eq(bankAuthStates.userId, admin.id), gt(bankAuthStates.expiresAt, new Date())))
    .then((r) => r[0])
  const account = pending?.accounts?.find((a) => a.uid === accountUid)
  if (!pending?.sessionId || !account) return { success: false, error: 'bankStateInvalid' }

  await saveConnection({
    aspspName: pending.aspspName,
    aspspCountry: pending.aspspCountry,
    psuType: pending.psuType,
    sessionId: pending.sessionId,
    account,
    validUntil: pending.validUntil,
    userId: admin.id,
  })
  await db.delete(bankAuthStates).where(eq(bankAuthStates.state, state))

  revalidatePath('/members/admin/bank')
  return { success: true }
}

export async function syncBankNow(): Promise<{
  success: boolean
  error?: string
  result?: { fetched: number; new: number; autoRecorded: number; needsReview: number }
}> {
  await requireAdmin()
  const connection = await currentConnection()
  if (!connection || connection.status !== 'active') return { success: false, error: 'bankNotConnected' }
  // Banks allow about four background fetches a day; keep manual syncs sparse.
  if (connection.lastSyncedAt && Date.now() - connection.lastSyncedAt.getTime() < SYNC_NOW_INTERVAL_MS) {
    return { success: false, error: 'bankSyncTooSoon' }
  }

  const result = await syncBankConnection(connection)
  revalidatePath('/members/admin/bank')
  revalidatePath('/members/admin/bank-import')
  revalidatePath('/members/admin/invoices')
  if (result.error) return { success: false, error: 'bankSyncFailed' }
  return { success: true, result }
}

export async function disconnectBank(): Promise<{ success: boolean }> {
  await requireAdmin()
  const connection = await currentConnection()
  if (!connection) return { success: true }
  await deleteSession(connection.sessionId).catch(() => {
    // Already ended at the bank.
  })
  await db
    .update(bankConnections)
    .set({ status: 'revoked', updatedAt: new Date() })
    .where(eq(bankConnections.id, connection.id))
  revalidatePath('/members/admin/bank')
  return { success: true }
}
