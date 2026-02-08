'use server'

import { getMember } from '@/lib/auth-server'
import { db } from '@/db'
import { user } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { profileUpdateSchema, type ProfileUpdateFormData } from '@/lib/validation'

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
