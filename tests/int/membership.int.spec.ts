import { describe, it, expect } from 'vitest'
import { getCardData, type CardMember } from '@/lib/membership'

const base: CardMember = {
  id: 'user_1',
  name: 'Anna Andersson',
  firstName: 'Anna',
  lastName: 'Andersson',
  memberNumber: 7,
  memberSince: new Date('2024-01-01T00:00:00.000Z'),
}

describe('getCardData', () => {
  it('marks active members valid', () => {
    const card = getCardData({ ...base, status: 'active' })
    expect(card.isValid).toBe(true)
    expect(card.isHonorary).toBe(false)
    expect(card.fullName).toBe('Anna Andersson')
    expect(card.memberNumber).toBe(7)
  })

  it('marks honorary members valid', () => {
    const card = getCardData({ ...base, status: 'honorary' })
    expect(card.isValid).toBe(true)
    expect(card.isHonorary).toBe(true)
  })

  it('marks inactive members invalid', () => {
    const card = getCardData({ ...base, status: 'inactive' })
    expect(card.isValid).toBe(false)
    expect(card.isHonorary).toBe(false)
  })

  it('defaults missing status to active', () => {
    const card = getCardData({ ...base, status: null })
    expect(card.status).toBe('active')
    expect(card.isValid).toBe(true)
  })

  it('falls back to name when first/last are missing', () => {
    const card = getCardData({ id: 'u', name: 'Fallback Name', status: 'active' })
    expect(card.fullName).toBe('Fallback Name')
    expect(card.memberNumber).toBeNull()
  })
})
