import { db } from '@/db'
import { bankConnections, bankTransactions, invoices, user } from '@/db/schema'
import { eq, inArray, lt } from 'drizzle-orm'
import { EnableBankingError, getSession, getTransactions, type EbTransaction } from './enablebanking'
import { matchEntries, type OpenInvoice } from './bank-matching'
import { findReferenceInText } from './reference-number'
import { recordPayment } from './payments'
import { sendEmail } from './email-sender'
import { getSettings } from './settings'
import { formatDate } from './format-date'

const DAY_MS = 24 * 60 * 60 * 1000

// --- Pure helpers (unit tested) ---

/**
 * First day to fetch: three days before the last sync (late-booked entries),
 * never more than 89 days back (PSD2 only guarantees 90 days without a new
 * bank login), and 30 days back on the very first sync.
 */
export function syncWindowStart(lastSyncedAt: Date | null, now: Date = new Date()): string {
  const floor = now.getTime() - 89 * DAY_MS
  const from = lastSyncedAt ? lastSyncedAt.getTime() - 3 * DAY_MS : now.getTime() - 30 * DAY_MS
  return new Date(Math.max(from, floor)).toISOString().slice(0, 10)
}

export interface SyncEntry {
  bankEntryRef: string
  bookingDate: string
  amount: number
  reference: string
  remittance: string
  debtorName: string | null
}

/**
 * Booked incoming transactions as matchable entries. The entry key mirrors
 * the camt upload ("bank:<archive id>") so one payment is recorded once
 * whichever way it arrives.
 */
export function toSyncEntries(transactions: EbTransaction[]): SyncEntry[] {
  const seen = new Map<string, number>()
  return transactions
    .filter((tx) => tx.credit_debit_indicator === 'CRDT' && tx.status === 'BOOK')
    .map((tx) => {
      const remittance = (tx.remittance_information ?? []).join(' ').trim()
      const reference = tx.reference_number?.replace(/\s/g, '') || findReferenceInText(remittance)
      const bookingDate = tx.booking_date ?? tx.value_date ?? tx.transaction_date ?? ''
      const amount = Number(tx.transaction_amount.amount)
      let bankEntryRef: string
      if (tx.entry_reference) bankEntryRef = `bank:${tx.entry_reference}`
      else if (tx.transaction_id) bankEntryRef = `eb:${tx.transaction_id}`
      else {
        // No bank id at all: content key with an occurrence counter, as the camt parser does.
        const key = `${bookingDate}:${amount.toFixed(2)}:${reference}`
        const n = (seen.get(key) ?? 0) + 1
        seen.set(key, n)
        bankEntryRef = `content:${key}#${n}`
      }
      return { bankEntryRef, bookingDate, amount, reference, remittance, debtorName: tx.debtor?.name ?? null }
    })
    .filter((e) => e.bookingDate && e.amount > 0)
}

export const REMINDER_14_DAYS = 1
export const REMINDER_3_DAYS = 2

/** Which renewal reminder (if any) is due now and hasn't been sent yet. */
export function dueReminder(validUntil: Date, remindersSent: number, now: Date = new Date()): number {
  const daysLeft = (validUntil.getTime() - now.getTime()) / DAY_MS
  if (daysLeft <= 0) return 0
  if (daysLeft <= 3 && !(remindersSent & REMINDER_3_DAYS)) return REMINDER_3_DAYS
  if (daysLeft <= 14 && !(remindersSent & REMINDER_14_DAYS)) return REMINDER_14_DAYS
  return 0
}

// --- Sync ---

type Connection = typeof bankConnections.$inferSelect

export interface SyncResult {
  fetched: number
  new: number
  autoRecorded: number
  needsReview: number
  error?: string
}

const autoRecordEnabled = () => process.env.BANK_SYNC_AUTO_RECORD !== 'false'

export async function syncBankConnection(connection: Connection, now: Date = new Date()): Promise<SyncResult> {
  const result: SyncResult = { fetched: 0, new: 0, autoRecorded: 0, needsReview: 0 }
  try {
    // The consent can end early (revoked at the bank, shortened by the bank).
    const session = await getSession(connection.sessionId)
    if (session.status !== 'AUTHORIZED') {
      const status = session.status === 'EXPIRED' || connection.validUntil <= now ? 'expired' : 'revoked'
      await db
        .update(bankConnections)
        .set({ status, lastSyncError: `Session ${session.status}`, updatedAt: now })
        .where(eq(bankConnections.id, connection.id))
      await notifyAdmins('ended', { ...connection, status })
      return { ...result, error: `Session ${session.status}` }
    }

    const transactions = await getTransactions(connection.accountUid, syncWindowStart(connection.lastSyncedAt, now))
    const entries = toSyncEntries(transactions)
    result.fetched = entries.length

    // Store first; only rows not seen before continue to matching.
    const inserted = entries.length
      ? await db
          .insert(bankTransactions)
          .values(
            entries.map((e) => ({
              connectionId: connection.id,
              bankEntryRef: e.bankEntryRef,
              bookingDate: new Date(e.bookingDate),
              amount: e.amount.toFixed(2),
              reference: e.reference || null,
              remittance: e.remittance || null,
              debtorName: e.debtorName,
              status: 'needs_review' as const,
            })),
          )
          .onConflictDoNothing({ target: bankTransactions.bankEntryRef })
          .returning({ id: bankTransactions.id, bankEntryRef: bankTransactions.bankEntryRef })
      : []
    result.new = inserted.length

    const newEntries = entries
      .map((e) => ({ ...e, rowId: inserted.find((r) => r.bankEntryRef === e.bankEntryRef)?.id }))
      .filter((e): e is SyncEntry & { rowId: string } => Boolean(e.rowId))

    if (newEntries.length) {
      const open: OpenInvoice[] = await db
        .select({
          id: invoices.id,
          invoiceNumber: invoices.invoiceNumber,
          referenceNumber: invoices.referenceNumber,
          amount: invoices.amount,
          paidAmount: invoices.paidAmount,
          recipientName: invoices.recipientName,
          status: invoices.status,
        })
        .from(invoices)
        .where(inArray(invoices.status, ['sent', 'draft']))

      for (const m of matchEntries(newEntries, open)) {
        const auto = autoRecordEnabled() && m.matchedInvoice && !m.alreadyPaid && (m.kind === 'exact' || m.kind === 'split')
        if (!auto) {
          await db
            .update(bankTransactions)
            .set({ invoiceId: m.matchedInvoice?.id ?? null, matchKind: m.kind })
            .where(eq(bankTransactions.id, m.rowId))
          result.needsReview++
          continue
        }
        await db.transaction(async (tx) => {
          const recorded = await recordPayment(tx, {
            invoiceId: m.matchedInvoice!.id,
            amount: m.amount,
            paidAt: new Date(m.bookingDate),
            reference: m.reference || null,
            bankEntryRef: m.bankEntryRef,
            source: 'bank_sync',
          })
          await tx
            .update(bankTransactions)
            .set({
              // 'duplicate' means a camt upload already recorded this payment.
              status: recorded === 'recorded' ? 'auto_recorded' : 'recorded',
              invoiceId: m.matchedInvoice!.id,
              matchKind: m.kind,
              resolvedAt: now,
            })
            .where(eq(bankTransactions.id, m.rowId))
        })
        result.autoRecorded++
      }
    }

    // Retention: keep 13 months of fetched transactions.
    await db.delete(bankTransactions).where(lt(bankTransactions.createdAt, new Date(now.getTime() - 396 * DAY_MS)))

    await db
      .update(bankConnections)
      .set({ lastSyncedAt: now, lastSyncError: null, updatedAt: now })
      .where(eq(bankConnections.id, connection.id))
    return result
  } catch (error) {
    const message = error instanceof EnableBankingError ? error.message : 'Unexpected sync error'
    console.error('Bank sync failed', error instanceof EnableBankingError ? error.message : error)
    await db
      .update(bankConnections)
      .set({ lastSyncError: message, updatedAt: now })
      .where(eq(bankConnections.id, connection.id))
    return { ...result, error: message }
  }
}

/** Send a renewal reminder if one is due; returns whether one was sent. */
export async function sendRenewalReminderIfDue(connection: Connection, now: Date = new Date()): Promise<boolean> {
  const bit = dueReminder(connection.validUntil, connection.remindersSent, now)
  if (!bit) return false
  await notifyAdmins('expiring', connection)
  await db
    .update(bankConnections)
    .set({ remindersSent: connection.remindersSent | bit, updatedAt: now })
    .where(eq(bankConnections.id, connection.id))
  return true
}

/** Trilingual admin notice, like the other association emails. */
async function notifyAdmins(kind: 'expiring' | 'ended', connection: Connection): Promise<void> {
  try {
    const admins = await db.select({ email: user.email }).from(user).where(eq(user.role, 'admin'))
    if (!admins.length) return
    const settings = await getSettings()
    const url = `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/members/admin/bank`
    const until = formatDate(connection.validUntil, 'fi')
    const bank = `${connection.aspspName}${connection.iban ? ` (${connection.iban})` : ''}`
    const lines =
      kind === 'expiring'
        ? [
            `Bankkopplingen till ${bank} upphör ${until}. Förnya den för att betalningar ska fortsätta hämtas automatiskt.`,
            `Pankkiyhteys ${bank} päättyy ${until}. Uusi yhteys, jotta maksut haetaan jatkossakin automaattisesti.`,
            `The bank connection to ${bank} expires on ${until}. Renew it to keep fetching payments automatically.`,
          ]
        : [
            `Bankkopplingen till ${bank} har upphört. Betalningar hämtas inte längre automatiskt förrän den förnyas.`,
            `Pankkiyhteys ${bank} on päättynyt. Maksuja ei haeta automaattisesti ennen kuin yhteys uusitaan.`,
            `The bank connection to ${bank} has ended. Payments are no longer fetched automatically until it is renewed.`,
          ]
    const html = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #492a0d;">
      ${lines.map((l) => `<p>${l}</p>`).join('')}
      <p><a href="${url}" style="color: #c4873b;">${url}</a></p>
      <p style="color: #6b4423; font-size: 12px;">${settings.name}</p></div>`
    const subject =
      kind === 'expiring'
        ? 'Bankkoppling upphör snart / Pankkiyhteys päättymässä / Bank connection expiring'
        : 'Bankkoppling har upphört / Pankkiyhteys päättynyt / Bank connection ended'
    const from = settings.email ? `${settings.name} <${settings.email}>` : `${settings.name} <noreply@obws.fi>`
    for (const admin of admins) await sendEmail({ from, to: admin.email, subject, html })
  } catch (error) {
    console.error('Failed to notify admins about bank connection', error)
  }
}

export async function activeConnections(): Promise<Connection[]> {
  return db.select().from(bankConnections).where(eq(bankConnections.status, 'active'))
}
