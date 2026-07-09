import { db } from '@/db'
import { walletPassRegistrations } from '@/db/schema'
import { and, eq } from 'drizzle-orm'
import { authorizePass, ensureWalletPass } from '@/lib/wallet/apple-webservice'

export const runtime = 'nodejs'

type Params = Promise<{
  deviceLibraryIdentifier: string
  passTypeIdentifier: string
  serialNumber: string
}>

/** Register a device to receive updates for a pass. */
export async function POST(req: Request, { params }: { params: Params }) {
  const { deviceLibraryIdentifier, passTypeIdentifier, serialNumber } = await params
  if (!authorizePass(req, serialNumber)) return new Response('Unauthorized', { status: 401 })

  let pushToken: string | undefined
  try {
    pushToken = (await req.json())?.pushToken
  } catch {
    /* ignore */
  }
  if (!pushToken) return new Response('Bad Request', { status: 400 })

  const [existing] = await db
    .select({ id: walletPassRegistrations.id })
    .from(walletPassRegistrations)
    .where(
      and(
        eq(walletPassRegistrations.deviceLibraryIdentifier, deviceLibraryIdentifier),
        eq(walletPassRegistrations.serialNumber, serialNumber),
      ),
    )
    .limit(1)

  await ensureWalletPass(serialNumber)

  if (existing) {
    await db
      .update(walletPassRegistrations)
      .set({ pushToken })
      .where(eq(walletPassRegistrations.id, existing.id))
    return new Response(null, { status: 200 })
  }

  await db
    .insert(walletPassRegistrations)
    .values({ deviceLibraryIdentifier, passTypeIdentifier, serialNumber, pushToken })
  return new Response(null, { status: 201 })
}

/** Unregister a device from a pass. */
export async function DELETE(req: Request, { params }: { params: Params }) {
  const { deviceLibraryIdentifier, serialNumber } = await params
  if (!authorizePass(req, serialNumber)) return new Response('Unauthorized', { status: 401 })

  await db
    .delete(walletPassRegistrations)
    .where(
      and(
        eq(walletPassRegistrations.deviceLibraryIdentifier, deviceLibraryIdentifier),
        eq(walletPassRegistrations.serialNumber, serialNumber),
      ),
    )

  return new Response(null, { status: 200 })
}
