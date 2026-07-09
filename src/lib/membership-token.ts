import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Compact HMAC-signed token embedded in the membership-card QR code. Kept small
 * for QR density: `base64url(payload).base64url(sig)`.
 *
 * The token is a convenience hint for scanners; the verify endpoint re-checks
 * live membership status server-side, so the token alone is not authoritative.
 */

export interface MemberTokenPayload {
  /** member id */
  m: string
  /** member number (0 if unset) */
  n: number
}

function getSecret(): string {
  const secret = process.env.MEMBERSHIP_CARD_SECRET
  if (!secret) throw new Error('MEMBERSHIP_CARD_SECRET is not set')
  return secret
}

function b64url(buf: Buffer): string {
  return buf.toString('base64url')
}

function sign(data: string): string {
  return b64url(createHmac('sha256', getSecret()).update(data).digest())
}

export function signMemberToken(input: {
  memberId: string
  memberNumber: number | null
}): string {
  const payload: MemberTokenPayload = {
    m: input.memberId,
    n: input.memberNumber ?? 0,
  }
  const body = b64url(Buffer.from(JSON.stringify(payload)))
  return `${body}.${sign(body)}`
}

/** Returns the payload if the signature is valid, else null. */
export function verifyMemberToken(token: string): MemberTokenPayload | null {
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [body, sig] = parts

  const expected = sign(body)
  const sigBuf = Buffer.from(sig)
  const expectedBuf = Buffer.from(expected)
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    return null
  }

  let payload: MemberTokenPayload
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
  } catch {
    return null
  }

  if (typeof payload.m !== 'string' || typeof payload.n !== 'number') return null

  return payload
}

/**
 * The Apple pass `authenticationToken` — a deterministic HMAC over the serial
 * number (≥16 chars), so the PassKit web service can authenticate device
 * requests without storing per-pass tokens.
 */
export function signApplePassToken(serialNumber: string): string {
  return sign(`applepass:${serialNumber}`)
}

export function verifyApplePassToken(serialNumber: string, token: string): boolean {
  const expected = signApplePassToken(serialNumber)
  const a = Buffer.from(token)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}
