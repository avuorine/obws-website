'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/admin-guard'
import { db } from '@/db'
import { associationSettings } from '@/db/schema'
import { settingsSchema, type SettingsFormData } from '@/lib/validation'

export async function updateSettings(
  data: SettingsFormData,
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin()

  const parsed = settingsSchema.safeParse(data)
  if (!parsed.success) {
    return { success: false, error: 'Validation failed' }
  }

  const { nextInvoiceNumber, ...rest } = parsed.data

  await db
    .insert(associationSettings)
    .values({
      id: 1,
      ...rest,
      name: rest.name,
      address: rest.address || '',
      businessId: rest.businessId || '',
      iban: rest.iban || '',
      bic: rest.bic || '',
      email: rest.email || '',
      phone: rest.phone || '',
      nextInvoiceNumber: parseInt(nextInvoiceNumber, 10),
    })
    .onConflictDoUpdate({
      target: associationSettings.id,
      set: {
        ...rest,
        name: rest.name,
        address: rest.address || '',
        businessId: rest.businessId || '',
        iban: rest.iban || '',
        bic: rest.bic || '',
        email: rest.email || '',
        phone: rest.phone || '',
        nextInvoiceNumber: parseInt(nextInvoiceNumber, 10),
      },
    })

  revalidatePath('/members/admin/settings')
  return { success: true }
}
