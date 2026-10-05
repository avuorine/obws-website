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

/**
 * Which binding rule a member signs up under, for the confirmation dialog,
 * the note on the event page and the confirmation email:
 * - freeCancelUntil: free cancellation until the deadline, binding after
 * - bindingNow: the deadline has already passed, binding immediately
 * - noCancellation: the event never allows cancelling
 * - cancelAnytime: cancellation allowed with no deadline (not binding)
 */
export type BindingRule = 'freeCancelUntil' | 'bindingNow' | 'noCancellation' | 'cancelAnytime'

export function bindingRule(event: EventDeadlines, now: Date = new Date()): BindingRule {
  if (event.cancellationAllowed === false) return 'noCancellation'
  if (!event.cancellationDeadline) return 'cancelAnytime'
  return now > event.cancellationDeadline ? 'bindingNow' : 'freeCancelUntil'
}

/**
 * The terms a signup is made under. Binding signups (every signup since
 * automatic invoicing) are 'binding'; older registrations keep the event's
 * cancellation rule.
 */
export type SignupRule = BindingRule | 'binding'

interface RegistrationTerms {
  autoInvoice: boolean
  status: string
}

/**
 * Why a member may not cancel their registration or remove a guest, or null
 * when they may. A binding signup can withdraw from the waitlist or lottery
 * but never give up an allocated seat; older registrations follow the
 * event's cancellation rules.
 */
export function memberCancelBlockReason(
  event: EventDeadlines,
  reg: RegistrationTerms,
  now: Date = new Date(),
): 'registrationBinding' | 'cancellationNotAllowed' | 'cancellationDeadlinePassed' | null {
  if (reg.autoInvoice) return reg.status === 'registered' ? 'registrationBinding' : null
  return cancellationBlockReason(event, now)
}

/** The rule shown to a member: their registration's terms, or 'binding' for a new signup. */
export function signupRule(event: EventDeadlines, reg: RegistrationTerms | null, now: Date = new Date()): SignupRule {
  return !reg || reg.autoInvoice ? 'binding' : bindingRule(event, now)
}
