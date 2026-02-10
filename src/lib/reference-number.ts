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
