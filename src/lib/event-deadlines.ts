interface EventDeadlines {
  registrationDeadline: Date | null
  cancellationAllowed: boolean | null
  cancellationDeadline: Date | null
}

/** Signing up, and adding guests, closes at the registration deadline. */
export function isRegistrationClosed(event: EventDeadlines, now: Date = new Date()): boolean {
  return event.registrationDeadline !== null && now > event.registrationDeadline
}

/**
 * Why a member may not cancel (their registration or a guest) right now, or
 * null when they may. The error codes match `events` translation keys.
 */
export function cancellationBlockReason(
  event: EventDeadlines,
  now: Date = new Date(),
): 'cancellationNotAllowed' | 'cancellationDeadlinePassed' | null {
  if (event.cancellationAllowed === false) return 'cancellationNotAllowed'
  if (event.cancellationDeadline && now > event.cancellationDeadline) return 'cancellationDeadlinePassed'
  return null
}
