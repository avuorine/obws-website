import { db } from '@/db'
import { walletPasses } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { verifyApplePassToken } from '@/lib/membership-token'

/** Validates the `Authorization: ApplePass <token>` header for a given serial. */
export function authorizePass(req: Request, serialNumber: string): boolean {
  const header = req.headers.get('authorization') ?? ''
  const prefix = 'ApplePass '
  if (!header.startsWith(prefix)) return false
  const token = header.slice(prefix.length)
  return token.length > 0 && verifyApplePassToken(serialNumber, token)
}

/** Creates the pass's "last modified" row if absent (does not move an existing tag). */
export async function ensureWalletPass(serialNumber: string): Promise<void> {
  await db
    .insert(walletPasses)
    .values({ serialNumber })
    .onConflictDoNothing({ target: walletPasses.serialNumber })
}

/** Moves the pass's "last modified" tag to now (call when content changes). */
export async function bumpWalletPass(serialNumber: string): Promise<void> {
  const now = new Date()
  await db
    .insert(walletPasses)
    .values({ serialNumber, updatedAt: now })
    .onConflictDoUpdate({ target: walletPasses.serialNumber, set: { updatedAt: now } })
}

export async function getPassUpdatedAt(serialNumber: string): Promise<Date | null> {
  const [row] = await db
    .select({ updatedAt: walletPasses.updatedAt })
    .from(walletPasses)
    .where(eq(walletPasses.serialNumber, serialNumber))
    .limit(1)
  return row?.updatedAt ?? null
}
