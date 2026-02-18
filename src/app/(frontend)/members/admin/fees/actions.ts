'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/admin-guard'
import { db } from '@/db'
import { feePeriods, memberFees, user, invoices } from '@/db/schema'
import { eq, and, inArray } from 'drizzle-orm'
import { feePeriodSchema, type FeePeriodFormData } from '@/lib/validation'
import { parseDatetimeLocal } from '@/lib/timezone'

export async function createFeePeriod(
  data: FeePeriodFormData,
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin()

  const parsed = feePeriodSchema.safeParse(data)
  if (!parsed.success) return { success: false, error: 'Validation failed' }

  await db.insert(feePeriods).values({
    name: parsed.data.name,
    amount: parsed.data.amount,
    startDate: parseDatetimeLocal(parsed.data.startDate + 'T00:00'),
    endDate: parseDatetimeLocal(parsed.data.endDate + 'T00:00'),
    dueDate: parseDatetimeLocal(parsed.data.dueDate + 'T00:00'),
  })

  revalidatePath('/members/admin/fees')
  return { success: true }
}

export async function generateFeesForPeriod(
  feePeriodId: string,
): Promise<{ success: boolean; count?: number; error?: string }> {
  await requireAdmin()

  // Get active + honorary members
  const members = await db
    .select({ id: user.id })
    .from(user)
    .where(inArray(user.status, ['active', 'honorary']))

  // Get members who already have fees for this period
  const existingFees = await db
    .select({ userId: memberFees.userId })
    .from(memberFees)
    .where(eq(memberFees.feePeriodId, feePeriodId))

  const existingUserIds = new Set(existingFees.map((f) => f.userId))
  const newMembers = members.filter((m) => !existingUserIds.has(m.id))

  if (newMembers.length > 0) {
    await db.insert(memberFees).values(
      newMembers.map((m) => ({
        userId: m.id,
        feePeriodId,
        status: 'unpaid' as const,
      })),
    )
  }

  revalidatePath(`/members/admin/fees/${feePeriodId}`)
  return { success: true, count: newMembers.length }
}

export async function markFeeAsPaid(
  memberFeeId: string,
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin()

  const now = new Date()
  await db
    .update(memberFees)
    .set({ status: 'paid', paidAt: now, updatedAt: now })
    .where(eq(memberFees.id, memberFeeId))

  // Also update related invoice if exists
  const fee = await db
    .select({ userId: memberFees.userId, feePeriodId: memberFees.feePeriodId })
    .from(memberFees)
    .where(eq(memberFees.id, memberFeeId))
    .then((r) => r[0])

  if (fee) {
    await db
      .update(invoices)
      .set({ status: 'paid', paidAt: now, updatedAt: now })
      .where(
        and(
          eq(invoices.userId, fee.userId),
          eq(invoices.feePeriodId, fee.feePeriodId),
          eq(invoices.type, 'membership_fee'),
        ),
      )
  }

  revalidatePath('/members/admin/fees')
  revalidatePath('/members/admin/invoices')
  return { success: true }
}

export async function markFeeAsUnpaid(
  memberFeeId: string,
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin()

  await db
    .update(memberFees)
    .set({ status: 'unpaid', paidAt: null, updatedAt: new Date() })
    .where(eq(memberFees.id, memberFeeId))

  revalidatePath('/members/admin/fees')
  return { success: true }
}
