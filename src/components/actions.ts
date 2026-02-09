'use server'

import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { getMember } from '@/lib/auth-server'
import { db } from '@/db'
import {
  user,
  session,
  account,
  passkey,
  verification,
  eventRegistrations,
  events,
  invoices,
  memberFees,
  feePeriods,
} from '@/db/schema'
import { eq } from 'drizzle-orm'
import { profileUpdateSchema, type ProfileUpdateFormData } from '@/lib/validation'
import { getLocalized } from '@/lib/localize'

export async function updateProfile(
  data: ProfileUpdateFormData,
): Promise<{ success: boolean; error?: string }> {
  const member = await getMember()
  if (!member) return { success: false, error: 'Not authenticated' }

  const parsed = profileUpdateSchema.safeParse(data)
  if (!parsed.success) return { success: false, error: 'Validation failed' }

  await db
    .update(user)
    .set({
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      name: `${parsed.data.firstName} ${parsed.data.lastName}`,
      phone: parsed.data.phone || null,
      municipality: parsed.data.municipality || null,
      updatedAt: new Date(),
    })
    .where(eq(user.id, member.id))

  return { success: true }
}

export async function updateEmailPreferences(
  marketingEmails: boolean,
): Promise<{ success: boolean }> {
  const member = await getMember()
  if (!member) return { success: false }

  await db
    .update(user)
    .set({ marketingEmails, updatedAt: new Date() })
    .where(eq(user.id, member.id))

  return { success: true }
}

export async function exportMyData(): Promise<{ success: boolean; data?: string; error?: string }> {
  const member = await getMember()
  if (!member) return { success: false, error: 'Not authenticated' }

  const [userData] = await db.select().from(user).where(eq(user.id, member.id))
  if (!userData) return { success: false, error: 'User not found' }

  const registrations = await db
    .select({
      eventTitle: events.titleLocales,
      eventDate: events.date,
      status: eventRegistrations.status,
      registeredAt: eventRegistrations.registeredAt,
    })
    .from(eventRegistrations)
    .innerJoin(events, eq(eventRegistrations.eventId, events.id))
    .where(eq(eventRegistrations.userId, member.id))

  const userInvoices = await db
    .select({
      invoiceNumber: invoices.invoiceNumber,
      type: invoices.type,
      amount: invoices.amount,
      description: invoices.description,
      dueDate: invoices.dueDate,
      status: invoices.status,
      createdAt: invoices.createdAt,
    })
    .from(invoices)
    .where(eq(invoices.userId, member.id))

  const fees = await db
    .select({
      periodName: feePeriods.name,
      amount: feePeriods.amount,
      status: memberFees.status,
      paidAt: memberFees.paidAt,
    })
    .from(memberFees)
    .innerJoin(feePeriods, eq(memberFees.feePeriodId, feePeriods.id))
    .where(eq(memberFees.userId, member.id))

  const exportData = {
    personalData: {
      name: userData.name,
      firstName: userData.firstName,
      lastName: userData.lastName,
      email: userData.email,
      phone: userData.phone,
      municipality: userData.municipality,
      dateOfBirth: userData.dateOfBirth,
      status: userData.status,
      memberNumber: userData.memberNumber,
      memberSince: userData.memberSince,
      marketingEmails: userData.marketingEmails,
      createdAt: userData.createdAt,
    },
    eventRegistrations: registrations.map((r) => ({
      event: getLocalized(r.eventTitle, 'sv'),
      date: r.eventDate,
      status: r.status,
      registeredAt: r.registeredAt,
    })),
    invoices: userInvoices,
    memberFees: fees,
    exportedAt: new Date().toISOString(),
  }

  return { success: true, data: JSON.stringify(exportData, null, 2) }
}

export async function deleteMyAccount(): Promise<{ success: boolean; error?: string }> {
  const member = await getMember()
  if (!member) return { success: false, error: 'Not authenticated' }

  // Delete auth-related data
  await db.delete(session).where(eq(session.userId, member.id))
  await db.delete(account).where(eq(account.userId, member.id))
  await db.delete(passkey).where(eq(passkey.userId, member.id))
  await db.delete(verification).where(eq(verification.identifier, member.email))

  // Anonymize user record
  await db
    .update(user)
    .set({
      firstName: 'Deleted',
      lastName: 'User',
      name: 'Deleted User',
      email: `deleted-${member.id}@removed.invalid`,
      phone: null,
      municipality: null,
      dateOfBirth: null,
      status: 'inactive',
      resignedAt: new Date(),
      marketingEmails: false,
      updatedAt: new Date(),
    })
    .where(eq(user.id, member.id))

  // Clear session cookie and redirect
  const cookieStore = await cookies()
  cookieStore.delete('better-auth.session_token')

  redirect('/')
}
