import { db } from '@/db'
import { bankConnections } from '@/db/schema'
import { desc, eq } from 'drizzle-orm'
import { deleteSession, type SessionAccount } from './enablebanking'

export type BankConnection = typeof bankConnections.$inferSelect

const normalizeIban = (iban: string) => iban.replace(/\s/g, '').toUpperCase()

export interface PendingAccount {
  uid: string
  iban: string | null
  name: string | null
}

export const toPendingAccounts = (accounts: SessionAccount[]): PendingAccount[] =>
  accounts.map((a) => ({ uid: a.uid, iban: a.account_id?.iban ?? null, name: a.name ?? null }))

/**
 * The organisation's bank connection: the most recent row, whatever its
 * status, so an expired one can be shown and renewed. (One organisation
 * today; this is where an organisation id filter goes later.)
 */
export async function currentConnection(): Promise<BankConnection | null> {
  return db
    .select()
    .from(bankConnections)
    .orderBy(desc(bankConnections.createdAt))
    .limit(1)
    .then((r) => r[0] ?? null)
}

/**
 * The account to use without asking: the one matching the association's
 * IBAN, else the only one. Null when the admin has to choose.
 */
export function pickAccount(accounts: PendingAccount[], settingsIban: string | null | undefined): PendingAccount | null {
  const wanted = normalizeIban(settingsIban ?? '')
  if (wanted) {
    const match = accounts.find((a) => a.iban && normalizeIban(a.iban) === wanted)
    if (match) return match
  }
  return accounts.length === 1 ? accounts[0] : null
}

/**
 * Save a freshly authorised session. Renewing updates the existing row
 * (keeping lastSyncedAt so the sync window continues) and closes the old
 * bank session.
 */
export async function saveConnection(input: {
  aspspName: string
  aspspCountry: string
  psuType: string
  sessionId: string
  account: PendingAccount
  validUntil: Date
  userId: string
}): Promise<void> {
  const existing = await currentConnection()
  const values = {
    aspspName: input.aspspName,
    aspspCountry: input.aspspCountry,
    psuType: input.psuType,
    sessionId: input.sessionId,
    accountUid: input.account.uid,
    iban: input.account.iban,
    accountName: input.account.name,
    validUntil: input.validUntil,
    status: 'active' as const,
    lastSyncError: null,
    remindersSent: 0,
    updatedAt: new Date(),
  }

  if (existing) {
    await db.update(bankConnections).set(values).where(eq(bankConnections.id, existing.id))
    if (existing.sessionId !== input.sessionId) {
      await deleteSession(existing.sessionId).catch(() => {
        // Already expired or revoked at the bank; nothing to close.
      })
    }
  } else {
    await db.insert(bankConnections).values({ ...values, createdBy: input.userId })
  }
}
