import { timingSafeEqual } from 'crypto'
import { activeConnections, sendRenewalReminderIfDue, syncBankConnection } from '@/lib/bank-sync'
import { isConfigured } from '@/lib/enablebanking'

// Runs nightly from Vercel Cron (vercel.json). Vercel sends
// "Authorization: Bearer <CRON_SECRET>".
export const dynamic = 'force-dynamic'
export const maxDuration = 60

function authorised(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const given = Buffer.from(request.headers.get('authorization') ?? '')
  const expected = Buffer.from(`Bearer ${secret}`)
  return given.length === expected.length && timingSafeEqual(given, expected)
}

export async function GET(request: Request) {
  if (!authorised(request)) return new Response('Unauthorized', { status: 401 })
  if (!isConfigured()) return Response.json({ skipped: 'not configured' })

  const results = []
  for (const connection of await activeConnections()) {
    const result = await syncBankConnection(connection)
    const reminded = await sendRenewalReminderIfDue(connection)
    // Counts only: no payer data in logs.
    results.push({ connection: connection.id, ...result, reminded })
  }
  console.log('Bank sync', JSON.stringify(results))
  return Response.json({ results })
}
