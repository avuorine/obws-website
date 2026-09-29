import { describe, it, expect } from 'vitest'
import { registrationPayment, eventPaymentStats } from '@/lib/event-payments'

const now = new Date('2026-09-20T12:00:00Z')
const past = new Date('2026-09-10T12:00:00Z')
const future = new Date('2026-09-30T12:00:00Z')

const inv = (id: string, status: string, dueDate: Date, amount: number, paidAmount = 0, eventRegistrationId: string | null = 'r1') => ({
  id, status, dueDate, amount: String(amount), paidAmount: String(paidAmount), eventRegistrationId,
})

describe('registrationPayment', () => {
  it('is not invoiced without live invoices', () => {
    expect(registrationPayment([], now).status).toBe('not_invoiced')
    expect(registrationPayment([inv('a', 'cancelled', past, 30)], now).status).toBe('not_invoiced')
  })

  it('reports paid and sums amounts', () => {
    expect(registrationPayment([inv('a', 'paid', past, 30, 30)], now)).toEqual({ status: 'paid', amount: 30, paid: 30, invoiceId: 'a' })
  })

  it('lets the most urgent invoice decide and link', () => {
    const result = registrationPayment([inv('a', 'paid', past, 30, 30), inv('b', 'sent', past, 15)], now)
    expect(result).toEqual({ status: 'overdue', amount: 45, paid: 30, invoiceId: 'b' })
  })

  it('distinguishes partial, sent and draft', () => {
    expect(registrationPayment([inv('a', 'sent', future, 30, 10)], now).status).toBe('partial')
    expect(registrationPayment([inv('a', 'sent', future, 30)], now).status).toBe('sent')
    expect(registrationPayment([inv('a', 'draft', future, 30)], now).status).toBe('draft')
  })
})

describe('eventPaymentStats', () => {
  it('computes expected revenue from registered seats and money from issued invoices', () => {
    const regs = [
      { id: 'r1', status: 'registered', guestCount: 1 },
      { id: 'r2', status: 'registered', guestCount: 0 },
      { id: 'r3', status: 'waitlisted', guestCount: 0 },
      { id: 'r4', status: 'cancelled', guestCount: 0 },
    ]
    const invoices = [
      inv('a', 'paid', past, 60, 60, 'r1'),
      inv('b', 'sent', past, 30, 10, 'r2'),
      inv('c', 'draft', future, 30, 0, 'r3'),
      inv('d', 'paid', past, 30, 30, 'r4'), // cancelled registration awaiting refund
    ]
    const { stats, byRegistration } = eventPaymentStats(regs, invoices, 30, now)
    expect(stats.expected).toBe(90)
    expect(stats.invoiced).toBe(120)
    expect(stats.paid).toBe(100)
    expect(stats.outstanding).toBe(20)
    expect(stats.overdue).toBe(20)
    expect(stats.counts).toMatchObject({ paid: 1, overdue: 1, draft: 0 })
    expect(byRegistration.get('r3')?.status).toBe('draft')
  })
})
