import { describe, it, expect } from 'vitest'
import { summarizeOverdue } from '@/lib/overdue-balance'

const now = new Date('2026-09-20T12:00:00Z')
const past = new Date('2026-09-10T12:00:00Z')
const future = new Date('2026-09-30T12:00:00Z')

describe('summarizeOverdue', () => {
  it('returns null when nothing is overdue', () => {
    expect(summarizeOverdue([], now)).toBeNull()
    expect(summarizeOverdue([{ status: 'sent', dueDate: future, amount: '30' }], now)).toBeNull()
  })

  it('ignores drafts, paid and cancelled invoices even past due', () => {
    const rows = ['draft', 'paid', 'cancelled'].map((status) => ({ status, dueDate: past, amount: '30' }))
    expect(summarizeOverdue(rows, now)).toBeNull()
  })

  it('counts sent invoices past due and sums what is still owed', () => {
    const result = summarizeOverdue(
      [
        { status: 'sent', dueDate: past, amount: '30.00', paidAmount: '0' },
        { status: 'sent', dueDate: past, amount: '50.00', paidAmount: '20.00' },
        { status: 'sent', dueDate: future, amount: '99.00', paidAmount: '0' },
      ],
      now,
    )
    expect(result).toEqual({ count: 2, total: 60 })
  })
})
