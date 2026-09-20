/**
 * Finnish bank reference number (viitemaksu) generator.
 * Uses weights 7, 3, 1 from right to left, check digit appended.
 */
export function generateReferenceNumber(base: number): string {
  const digits = String(base)
  const weights = [7, 3, 1]
  let sum = 0

  for (let i = digits.length - 1, w = 0; i >= 0; i--, w++) {
    sum += parseInt(digits[i], 10) * weights[w % 3]
  }

  const checkDigit = (10 - (sum % 10)) % 10
  return digits + checkDigit
}

export function formatReferenceNumber(ref: string): string {
  const parts: string[] = []
  for (let i = 0; i < ref.length; i += 5) {
    parts.push(ref.slice(i, i + 5))
  }
  return parts.join(' ')
}

/**
 * Normalise a reference number for matching. Banks deliver the same
 * reference in several shapes: as generated ("102542"), zero-padded to
 * 20 digits ("00000000000000102542") or as the international RF variant
 * ("RF18000000000000102542"). All of these collapse to "102542".
 */
export function normalizeReferenceNumber(raw: string): string {
  let ref = raw.replace(/[^0-9A-Za-z]/g, '').toUpperCase()
  // RF creditor reference: "RF" + 2 check digits + national reference
  if (ref.startsWith('RF') && ref.length > 4) ref = ref.slice(4)
  ref = ref.replace(/^0+/, '')
  return ref
}
