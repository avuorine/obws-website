import { describe, it, expect } from 'vitest'
import {
  generateReferenceNumber,
  normalizeReferenceNumber,
} from '@/lib/reference-number'

describe('reference-number', () => {
  it('appends a valid 7-3-1 check digit', () => {
    // 1234 → 4*7 + 3*3 + 2*1 + 1*7 = 46 → check digit 4
    expect(generateReferenceNumber(1234)).toBe('12344')
  })

  describe('normalizeReferenceNumber', () => {
    const generated = generateReferenceNumber(10254)

    it('leaves a plain reference unchanged', () => {
      expect(normalizeReferenceNumber(generated)).toBe(generated)
    })

    it('strips zero padding to 20 digits', () => {
      expect(normalizeReferenceNumber(generated.padStart(20, '0'))).toBe(generated)
    })

    it('strips the RF prefix and its check digits', () => {
      expect(normalizeReferenceNumber(`RF18${generated.padStart(20, '0')}`)).toBe(generated)
    })

    it('ignores whitespace and grouping', () => {
      expect(normalizeReferenceNumber(' 00000 00000 00000 ' + generated)).toBe(generated)
      expect(normalizeReferenceNumber('RF18 0000 0000 0000 00' + generated)).toBe(generated)
    })

    it('collapses all bank formats to the same key', () => {
      const forms = [
        generated,
        generated.padStart(20, '0'),
        `RF18${generated.padStart(20, '0')}`,
        `rf18${generated}`,
      ]
      expect(new Set(forms.map(normalizeReferenceNumber)).size).toBe(1)
    })

    it('returns an empty string for an empty or all-zero reference', () => {
      expect(normalizeReferenceNumber('')).toBe('')
      expect(normalizeReferenceNumber('00000000000000000000')).toBe('')
    })
  })
})
