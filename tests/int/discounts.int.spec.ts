import { describe, it, expect } from 'vitest'
import { discountSchema } from '@/lib/validation'

const base = { nameSv: 'Kyrö Distillery', offerSv: '10 % rabatt', active: true }

describe('discountSchema', () => {
  it('requires the Swedish name and offer', () => {
    expect(discountSchema.safeParse(base).success).toBe(true)
    expect(discountSchema.safeParse({ ...base, nameSv: '  ' }).success).toBe(false)
    expect(discountSchema.safeParse({ ...base, offerSv: '' }).success).toBe(false)
  })

  it('accepts only http(s) websites', () => {
    expect(discountSchema.safeParse({ ...base, url: 'https://visit.kyrodistillery.com' }).success).toBe(true)
    expect(discountSchema.safeParse({ ...base, url: '' }).success).toBe(true)
    expect(discountSchema.safeParse({ ...base, url: 'javascript:alert(1)' }).success).toBe(false)
    expect(discountSchema.safeParse({ ...base, url: 'visit.kyrodistillery.com' }).success).toBe(false)
  })
})
