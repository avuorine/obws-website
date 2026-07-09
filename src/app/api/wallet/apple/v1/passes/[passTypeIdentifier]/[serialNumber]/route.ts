import { db } from '@/db'
import { user } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { getCardData } from '@/lib/membership'
import { buildApplePassForMember } from '@/lib/wallet/apple'
import { authorizePass, getPassUpdatedAt } from '@/lib/wallet/apple-webservice'

export const runtime = 'nodejs'

type Params = Promise<{ passTypeIdentifier: string; serialNumber: string }>

/** Returns the latest signed pass for a serial (= user id). */
export async function GET(req: Request, { params }: { params: Params }) {
  const { serialNumber } = await params
  if (!authorizePass(req, serialNumber)) return new Response('Unauthorized', { status: 401 })

  const [member] = await db.select().from(user).where(eq(user.id, serialNumber)).limit(1)
  if (!member) return new Response('Not Found', { status: 404 })

  const updatedAt = (await getPassUpdatedAt(serialNumber)) ?? new Date()
  const ifModifiedSince = req.headers.get('if-modified-since')
  if (ifModifiedSince) {
    const since = new Date(ifModifiedSince)
    // Second precision: HTTP dates drop milliseconds.
    if (!isNaN(since.getTime()) && Math.floor(updatedAt.getTime() / 1000) <= Math.floor(since.getTime() / 1000)) {
      return new Response(null, { status: 304 })
    }
  }

  try {
    const card = getCardData(member)
    const buffer = await buildApplePassForMember(card)

    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.apple.pkpass',
        'Last-Modified': updatedAt.toUTCString(),
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('Failed to rebuild Apple Wallet pass', err)
    return new Response('Pass unavailable', { status: 500 })
  }
}
