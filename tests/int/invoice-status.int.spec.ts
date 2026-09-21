import { describe, it, expect } from 'vitest'
import { isOverdue, effectiveInvoiceStatus, daysOverdue, remainingAmount } from '@/lib/invoice-status'

const now = new Date('2026-09-20T12:00:00Z')
const past = new Date('2026-09-10T12:00:00Z')
const future = new Date('2026-09-30T12:00:00Z')

describe('invoice-status', () => {
  it('flags a sent invoice past its due date as overdue', () => {
    expect(isOverdue({ status: 'sent', dueDate: past }, now)).toBe(true)
    expect(effectiveInvoiceStatus({ status: 'sent', dueDate: past }, now)).toBe('overdue')
  })

  it('does not flag sent invoices that are not yet due', () => {
    expect(isOverdue({ status: 'sent', dueDate: future }, now)).toBe(false)
    expect(effectiveInvoiceStatus({ status: 'sent', dueDate: future }, now)).toBe('sent')
  })

  it('never flags drafts, paid or cancelled invoices, even past due', () => {
    for (const status of ['draft', 'paid', 'cancelled']) {
      expect(isOverdue({ status, dueDate: past }, now)).toBe(false)
      expect(effectiveInvoiceStatus({ status, dueDate: past }, now)).toBe(status)
    }
  })

  it('counts whole days overdue and never goes negative', () => {
    expect(daysOverdue(past, now)).toBe(10)
    expect(daysOverdue(future, now)).toBe(0)
  })
})

describe('invoice-status: partial payments', () => {
  const now = new Date('2026-09-20T12:00:00Z')
  const future = new Date('2026-09-30T12:00:00Z')
  const past = new Date('2026-09-10T12:00:00Z')

  it('reports a sent invoice with some payment as partial', () => {
    const inv = { status: 'sent', dueDate: future, amount: '50.00', paidAmount: '20.00' }
    expect(effectiveInvoiceStatus(inv, now)).toBe('partial')
    expect(remainingAmount(inv)).toBe(30)
  })

  it('lets overdue win over partial', () => {
    expect(effectiveInvoiceStatus({ status: 'sent', dueDate: past, amount: '50.00', paidAmount: '20.00' }, now)).toBe('overdue')
  })

  it('treats zero or missing paidAmount as plain sent', () => {
    expect(effectiveInvoiceStatus({ status: 'sent', dueDate: future, amount: '50.00', paidAmount: '0.00' }, now)).toBe('sent')
    expect(effectiveInvoiceStatus({ status: 'sent', dueDate: future }, now)).toBe('sent')
  })

  it('never reports remaining below zero on overpayment', () => {
    expect(remainingAmount({ status: 'paid', dueDate: past, amount: '50.00', paidAmount: '60.00' })).toBe(0)
  })
})
