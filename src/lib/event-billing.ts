import { db } from '@/db'
import { eventRegistrations, invoices, user } from '@/db/schema'
import { eq, and, ne } from 'drizzle-orm'

export interface RegistrationBilling {
  regId: string
  userId: string
  userName: string
  userEmail: string
  guestCount: number
  /** Seats the member currently occupies: 1 + guests. */
  currentSeats: number
  /** Seats already on sent or paid invoices. Immutable once issued. */
  issuedSeats: number
  /** An existing draft invoice, which may still be amended in place. */
  draft: { id: string; seatCount: number } | null
}

export interface EventBillingSummary {
  registrations: RegistrationBilling[]
  registered: number
  /** Issued + draft seats match the current seat count. */
  fullyInvoiced: number
  /** Fewer seats invoiced than occupied; Generate will fix these. */
  needsInvoice: number
  /** More seats on issued invoices than occupied; needs manual cancel + regenerate. */
  overbilled: number
}

/**
 * Per-registration billing state for an event: what each registered member
 * occupies today versus what has already been invoiced. Cancelled invoices
 * are ignored so a cancelled invoice can always be regenerated.
 */
export async function getEventBillingSummary(eventId: string): Promise<EventBillingSummary> {
  const rows = await db
    .select({
      regId: eventRegistrations.id,
      userId: eventRegistrations.userId,
      userName: user.name,
      userEmail: user.email,
      guestCount: eventRegistrations.guestCount,
    })
    .from(eventRegistrations)
    .innerJoin(user, eq(eventRegistrations.userId, user.id))
    .where(and(eq(eventRegistrations.eventId, eventId), eq(eventRegistrations.status, 'registered')))

  const invoiceRows = await db
    .select({
      id: invoices.id,
      eventRegistrationId: invoices.eventRegistrationId,
      status: invoices.status,
      seatCount: invoices.seatCount,
    })
    .from(invoices)
    .innerJoin(eventRegistrations, eq(invoices.eventRegistrationId, eventRegistrations.id))
    .where(
      and(
        eq(eventRegistrations.eventId, eventId),
        eq(invoices.type, 'event_fee'),
        ne(invoices.status, 'cancelled'),
      ),
    )

  const byReg = new Map<string, { issued: number; draft: RegistrationBilling['draft'] }>()
  for (const inv of invoiceRows) {
    if (!inv.eventRegistrationId) continue
    const entry = byReg.get(inv.eventRegistrationId) ?? { issued: 0, draft: null }
    // Pre-migration rows without seat_count are treated as a single seat.
    const seats = inv.seatCount ?? 1
    if (inv.status === 'draft') {
      entry.draft = { id: inv.id, seatCount: seats }
    } else {
      entry.issued += seats
    }
    byReg.set(inv.eventRegistrationId, entry)
  }

  const registrations: RegistrationBilling[] = rows.map((r) => {
    const billing = byReg.get(r.regId) ?? { issued: 0, draft: null }
    return {
      ...r,
      currentSeats: 1 + r.guestCount,
      issuedSeats: billing.issued,
      draft: billing.draft,
    }
  })

  let fullyInvoiced = 0
  let needsInvoice = 0
  let overbilled = 0
  for (const r of registrations) {
    if (r.issuedSeats > r.currentSeats) overbilled++
    else if (r.issuedSeats + (r.draft?.seatCount ?? 0) === r.currentSeats) fullyInvoiced++
    else needsInvoice++
  }

  return { registrations, registered: registrations.length, fullyInvoiced, needsInvoice, overbilled }
}
