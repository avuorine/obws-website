import { describe, it, expect } from 'vitest'
import { bindingRule, cancellationBlockReason, isRegistrationClosed } from '@/lib/event-deadlines'

const now = new Date('2026-09-20T12:00:00Z')
const past = new Date('2026-09-10T12:00:00Z')
const future = new Date('2026-09-30T12:00:00Z')
const base = { registrationDeadline: null, cancellationAllowed: true, cancellationDeadline: null }

describe('event-deadlines', () => {
  it('closes registration (and guest sign-up) after the registration deadline', () => {
    expect(isRegistrationClosed(base, now)).toBe(false)
    expect(isRegistrationClosed({ ...base, registrationDeadline: future }, now)).toBe(false)
    expect(isRegistrationClosed({ ...base, registrationDeadline: past }, now)).toBe(true)
  })

  it('blocks cancelling when cancellation is disabled', () => {
    expect(cancellationBlockReason({ ...base, cancellationAllowed: false }, now)).toBe('cancellationNotAllowed')
  })

  it('blocks cancelling after the cancellation deadline', () => {
    expect(cancellationBlockReason({ ...base, cancellationDeadline: future }, now)).toBeNull()
    expect(cancellationBlockReason({ ...base, cancellationDeadline: past }, now)).toBe('cancellationDeadlinePassed')
  })
})

describe('bindingRule', () => {
  it('picks the rule a member signs up under', () => {
    expect(bindingRule({ ...base, cancellationAllowed: false }, now)).toBe('noCancellation')
    expect(bindingRule(base, now)).toBe('cancelAnytime')
    expect(bindingRule({ ...base, cancellationDeadline: future }, now)).toBe('freeCancelUntil')
    expect(bindingRule({ ...base, cancellationDeadline: past }, now)).toBe('bindingNow')
  })
})
