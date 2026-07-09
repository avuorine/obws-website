import { describe, it, expect, beforeAll } from 'vitest'
import {
  signMemberToken,
  verifyMemberToken,
  signApplePassToken,
  verifyApplePassToken,
} from '@/lib/membership-token'

beforeAll(() => {
  process.env.MEMBERSHIP_CARD_SECRET = 'test-secret-at-least-32-characters-long!!'
})

describe('membership-token', () => {
  it('round-trips a signed token', () => {
    const token = signMemberToken({ memberId: 'user_123', memberNumber: 142 })

    const payload = verifyMemberToken(token)
    expect(payload).not.toBeNull()
    expect(payload!.m).toBe('user_123')
    expect(payload!.n).toBe(142)
  })

  it('defaults a null member number to 0', () => {
    const token = signMemberToken({ memberId: 'h1', memberNumber: null })
    const payload = verifyMemberToken(token)
    expect(payload).not.toBeNull()
    expect(payload!.n).toBe(0)
  })

  it('rejects a tampered payload', () => {
    const token = signMemberToken({ memberId: 'user_123', memberNumber: 1 })
    const [body, sig] = token.split('.')
    const forged = Buffer.from(JSON.stringify({ m: 'admin', n: 1 })).toString('base64url')
    expect(verifyMemberToken(`${forged}.${sig}`)).toBeNull()
    // also reject a flipped signature
    expect(verifyMemberToken(`${body}.${sig.slice(0, -1)}X`)).toBeNull()
  })

  it('rejects malformed input', () => {
    expect(verifyMemberToken('not-a-token')).toBeNull()
    expect(verifyMemberToken('a.b.c')).toBeNull()
    expect(verifyMemberToken('')).toBeNull()
  })

  it('rejects a token signed with a different secret', () => {
    const token = signMemberToken({ memberId: 'user_123', memberNumber: 1 })
    process.env.MEMBERSHIP_CARD_SECRET = 'a-completely-different-secret-value-here!'
    expect(verifyMemberToken(token)).toBeNull()
    process.env.MEMBERSHIP_CARD_SECRET = 'test-secret-at-least-32-characters-long!!'
  })
})

describe('apple pass auth token', () => {
  it('round-trips and is at least 16 chars', () => {
    const token = signApplePassToken('user_123')
    expect(token.length).toBeGreaterThanOrEqual(16)
    expect(verifyApplePassToken('user_123', token)).toBe(true)
  })

  it('rejects a token for a different serial', () => {
    const token = signApplePassToken('user_123')
    expect(verifyApplePassToken('user_999', token)).toBe(false)
  })

  it('rejects a tampered token', () => {
    const token = signApplePassToken('user_123')
    expect(verifyApplePassToken('user_123', token.slice(0, -1) + 'X')).toBe(false)
    expect(verifyApplePassToken('user_123', '')).toBe(false)
  })
})
