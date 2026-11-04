import { timingSafeEqual } from 'crypto'
import { activeConnections, sendRenewalReminderIfDue, syncBankConnection } from '@/lib/bank-sync'
import { isConfigured } from '@/lib/enablebanking'
import {
  bankSyncIsFresh,
  releaseUnpaidSeats,
  retryUndeliveredInvoices,
  sendPaymentReminders,
} from '@/lib/seat-release'

// Runs nightly from Vercel Cron (vercel.json). Vercel sends
// "Authorization: Bearer <CRON_SECRET>".
export const dynamic = 'force-dynamic'
export const maxDuration = 300

function authorised(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const given = Buffer.from(request.headers.get('authorization') ?? '')
  const expected = Buffer.from(`Bearer ${secret}`)
  return given.length === expected.length && timingSafeEqual(given, expected)
}

/**
 * 1. Bank sync, so the steps below see last night's payments.
 * 2. Retry binding-signup invoices whose email failed.
 * 3. Payment reminders on the last day before an unpaid seat is released.
 * 4. Release unpaid seats — only when the bank sync is current, otherwise a
 *    paid seat could look unpaid.
 */
export async function GET(request: Request) {
  if (!authorised(request)) return new Response('Unauthorized', { status: 401 })
  const now = new Date()

  const bank = []
  if (isConfigured()) {
    for (const connection of await activeConnections()) {
      const result = await syncBankConnection(connection)
      const reminded = await sendRenewalReminderIfDue(connection)
      // Counts only: no payer data in logs.
      bank.push({ connection: connection.id, ...result, reminded })
    }
  }

  const invoicesRetried = await retryUndeliveredInvoices(now)
  const remindersSent = await sendPaymentReminders(now)
  const release = (await bankSyncIsFresh(new Date()))
    ? await releaseUnpaidSeats(now)
    : { skipped: 'bank sync not current' }

  const summary = { bank, invoicesRetried, remindersSent, release }
  console.log('Daily cron', JSON.stringify(summary))
  return Response.json(summary)
}
