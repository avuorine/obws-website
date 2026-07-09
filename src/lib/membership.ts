export type MemberStatus = 'active' | 'inactive' | 'honorary'

/** Subset of the better-auth user object needed to build a membership card. */
export interface CardMember {
  id: string
  name: string
  firstName?: string | null
  lastName?: string | null
  memberNumber?: number | null
  memberSince?: Date | string | null
  status?: MemberStatus | string | null
}

export interface MembershipCardData {
  memberId: string
  fullName: string
  memberNumber: number | null
  status: MemberStatus
  memberSince: Date | null
  /** A card is valid while the member is active or honorary. */
  isValid: boolean
  isHonorary: boolean
}

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null
  const d = typeof value === 'string' ? new Date(value) : value
  return isNaN(d.getTime()) ? null : d
}

/**
 * Build the normalized data used by the in-page card and both wallet passes.
 * Validity is derived purely from the member's status: active and honorary
 * members hold a valid card; inactive members do not.
 */
export function getCardData(member: CardMember): MembershipCardData {
  const status = (member.status as MemberStatus) ?? 'active'
  const isHonorary = status === 'honorary'

  const fullName =
    [member.firstName, member.lastName].filter(Boolean).join(' ').trim() || member.name

  return {
    memberId: member.id,
    fullName,
    memberNumber: member.memberNumber ?? null,
    status,
    memberSince: toDate(member.memberSince),
    isValid: status === 'active' || isHonorary,
    isHonorary,
  }
}
