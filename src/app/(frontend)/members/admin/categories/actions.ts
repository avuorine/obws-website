'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/admin-guard'
import { db } from '@/db'
import { eventCategories, events } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { categorySchema, type CategoryFormData } from '@/lib/validation'

export async function createCategory(
  data: CategoryFormData,
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin()

  const parsed = categorySchema.safeParse(data)
  if (!parsed.success) return { success: false, error: 'Validation failed' }

  await db.insert(eventCategories).values({
    slug: parsed.data.slug,
    nameLocales: {
      sv: parsed.data.nameSv,
      fi: parsed.data.nameFi || undefined,
      en: parsed.data.nameEn || undefined,
    },
    sortOrder: parsed.data.sortOrder ? Number(parsed.data.sortOrder) : 0,
  })

  revalidatePath('/members/admin/categories')
  return { success: true }
}

export async function updateCategory(
  id: string,
  data: CategoryFormData,
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin()

  const parsed = categorySchema.safeParse(data)
  if (!parsed.success) return { success: false, error: 'Validation failed' }

  await db
    .update(eventCategories)
    .set({
      slug: parsed.data.slug,
      nameLocales: {
        sv: parsed.data.nameSv,
        fi: parsed.data.nameFi || undefined,
        en: parsed.data.nameEn || undefined,
      },
      sortOrder: parsed.data.sortOrder ? Number(parsed.data.sortOrder) : 0,
    })
    .where(eq(eventCategories.id, id))

  revalidatePath('/members/admin/categories')
  return { success: true }
}

export async function deleteCategory(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin()

  const inUse = await db
    .select({ id: events.id })
    .from(events)
    .where(eq(events.categoryId, id))
    .limit(1)

  if (inUse.length > 0) {
    return { success: false, error: 'categoryInUse' }
  }

  await db.delete(eventCategories).where(eq(eventCategories.id, id))

  revalidatePath('/members/admin/categories')
  return { success: true }
}
