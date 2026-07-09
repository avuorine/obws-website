import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { walletPassRegistrations, walletPasses } from '@/db/schema'
import { and, eq, gt } from 'drizzle-orm'

export const runtime = 'nodejs'

type Params = Promise<{ deviceLibraryIdentifier: string; passTypeIdentifier: string }>

/**
 * Returns the serial numbers of passes registered to this device that have
 * changed since the `passesUpdatedSince` tag (epoch-ms string).
 */
export async function GET(req: NextRequest, { params }: { params: Params }) {
  const { deviceLibraryIdentifier, passTypeIdentifier } = await params

  const since = req.nextUrl.searchParams.get('passesUpdatedSince')
  const sinceDate = since ? new Date(Number(since)) : null

  const rows = await db
    .select({ serialNumber: walletPasses.serialNumber, updatedAt: walletPasses.updatedAt })
    .from(walletPassRegistrations)
    .innerJoin(walletPasses, eq(walletPasses.serialNumber, walletPassRegistrations.serialNumber))
    .where(
      and(
        eq(walletPassRegistrations.deviceLibraryIdentifier, deviceLibraryIdentifier),
        eq(walletPassRegistrations.passTypeIdentifier, passTypeIdentifier),
        sinceDate && !isNaN(sinceDate.getTime())
          ? gt(walletPasses.updatedAt, sinceDate)
          : undefined,
      ),
    )

  if (rows.length === 0) return new Response(null, { status: 204 })

  const lastUpdated = Math.max(...rows.map((r) => r.updatedAt.getTime()))
  return NextResponse.json({
    lastUpdated: String(lastUpdated),
    serialNumbers: rows.map((r) => r.serialNumber),
  })
}
