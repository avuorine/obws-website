'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/admin-guard'
import { db } from '@/db'
import { memberDiscounts } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { discountSchema, type DiscountFormData } from '@/lib/validation'

const orUndefined = (v?: string) => (v && v.trim() ? v.trim() : undefined)

function toRow(data: DiscountFormData) {
  const details = {
    sv: orUndefined(data.detailsSv),
    fi: orUndefined(data.detailsFi),
    en: orUndefined(data.detailsEn),
  }
  return {
    nameLocales: { sv: data.nameSv.trim(), fi: orUndefined(data.nameFi), en: orUndefined(data.nameEn) },
    offerLocales: { sv: data.offerSv.trim(), fi: orUndefined(data.offerFi), en: orUndefined(data.offerEn) },
    detailsLocales: details.sv || details.fi || details.en ? details : null,
    address: orUndefined(data.address) ?? null,
    url: orUndefined(data.url) ?? null,
    sortOrder: data.sortOrder ? Number(data.sortOrder) || 0 : 0,
    active: data.active,
  }
}

function revalidateDiscounts() {
  revalidatePath('/members/admin/discounts')
  revalidatePath('/members/discounts')
}

export async function createDiscount(data: DiscountFormData): Promise<{ success: boolean; error?: string }> {
  await requireAdmin()
  const parsed = discountSchema.safeParse(data)
  if (!parsed.success) return { success: false, error: 'Validation failed' }

  await db.insert(memberDiscounts).values(toRow(parsed.data))
  revalidateDiscounts()
  return { success: true }
}

export async function updateDiscount(id: string, data: DiscountFormData): Promise<{ success: boolean; error?: string }> {
  await requireAdmin()
  const parsed = discountSchema.safeParse(data)
  if (!parsed.success) return { success: false, error: 'Validation failed' }

  await db
    .update(memberDiscounts)
    .set({ ...toRow(parsed.data), updatedAt: new Date() })
    .where(eq(memberDiscounts.id, id))
  revalidateDiscounts()
  return { success: true }
}

export async function deleteDiscount(id: string): Promise<{ success: boolean }> {
  await requireAdmin()
  await db.delete(memberDiscounts).where(eq(memberDiscounts.id, id))
  revalidateDiscounts()
  return { success: true }
}
