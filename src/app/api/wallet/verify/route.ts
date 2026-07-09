import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { getMember } from '@/lib/auth-server'
import { db } from '@/db'
import { user } from '@/db/schema'
import { verifyMemberToken } from '@/lib/membership-token'
import { type MemberStatus } from '@/lib/membership'

export const runtime = 'nodejs'

/**
 * Verifies a membership-card QR token and re-checks live status server-side.
 * Admin-only for now; a dedicated staff scanner UI is a future phase.
 *
 * GET /api/wallet/verify?token=...
 */
export async function GET(req: NextRequest) {
  const admin = await getMember()
  if (!admin || admin.role !== 'admin') {
    return NextResponse.json({ valid: false, error: 'forbidden' }, { status: 403 })
  }

  const token = req.nextUrl.searchParams.get('token')
  if (!token) {
    return NextResponse.json({ valid: false, error: 'missing_token' }, { status: 400 })
  }

  const payload = verifyMemberToken(token)
  if (!payload) {
    return NextResponse.json({ valid: false, error: 'invalid_token' })
  }

  const [member] = await db
    .select({
      name: user.name,
      firstName: user.firstName,
      lastName: user.lastName,
      memberNumber: user.memberNumber,
      status: user.status,
    })
    .from(user)
    .where(eq(user.id, payload.m))
    .limit(1)

  if (!member) {
    return NextResponse.json({ valid: false, error: 'unknown_member' })
  }

  const status = (member.status as MemberStatus) ?? 'active'
  const valid = status === 'active' || status === 'honorary'

  const fullName =
    [member.firstName, member.lastName].filter(Boolean).join(' ').trim() || member.name

  return NextResponse.json({
    valid,
    name: fullName,
    memberNumber: member.memberNumber,
    status,
  })
}
