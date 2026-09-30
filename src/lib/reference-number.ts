/**
 * Finnish bank reference number (viitemaksu) generator.
 * Uses weights 7, 3, 1 from right to left, check digit appended.
 */
export function generateReferenceNumber(base: number): string {
  const digits = String(base)
  return digits + referenceCheckDigit(digits)
}

/** Check digit for a string of digits (string-based, so 19-digit bases stay exact). */
function referenceCheckDigit(digits: string): string {
  const weights = [7, 3, 1]
  let sum = 0

  for (let i = digits.length - 1, w = 0; i >= 0; i--, w++) {
    sum += parseInt(digits[i], 10) * weights[w % 3]
  }

  return String((10 - (sum % 10)) % 10)
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
 * ("RF41000000000000102542"). All of these collapse to "102542".
 */
export function normalizeReferenceNumber(raw: string): string {
  let ref = raw.replace(/[^0-9A-Za-z]/g, '').toUpperCase()
  // RF creditor reference: "RF" + 2 check digits + national reference
  if (ref.startsWith('RF') && ref.length > 4) ref = ref.slice(4)
  ref = ref.replace(/^0+/, '')
  return ref
}

/** A Finnish national reference (4–20 digits) whose check digit is correct. */
export function isValidFinnishReference(ref: string): boolean {
  if (!/^\d{4,20}$/.test(ref)) return false
  return referenceCheckDigit(ref.slice(0, -1)) === ref.slice(-1)
}

/** An RF creditor reference (ISO 11649) with a correct mod-97 check. */
export function isValidRfReference(ref: string): boolean {
  if (!/^RF\d{2}[0-9A-Z]{1,21}$/.test(ref)) return false
  const rearranged = ref.slice(4) + ref.slice(0, 4)
  const numeric = rearranged.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55))
  let rem = 0
  for (const d of numeric) rem = (rem * 10 + Number(d)) % 97
  return rem === 1
}

/**
 * Find a valid reference in free text (e.g. remittance lines), tolerating
 * the grouping spaces people and banks add. Returns '' when none is found.
 */
export function findReferenceInText(text: string): string {
  const upper = text.toUpperCase()
  for (const m of upper.matchAll(/RF\s?\d{2}(?:\s?[0-9A-Z]){1,21}/g)) {
    const candidate = m[0].replace(/\s/g, '')
    if (isValidRfReference(candidate)) return candidate
  }
  for (const m of upper.matchAll(/\d(?:[\d ]{2,28})\d/g)) {
    const candidate = m[0].replace(/\s/g, '')
    if (isValidFinnishReference(candidate)) return candidate
  }
  return ''
}
