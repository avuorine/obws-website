'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/admin-guard'
import { db } from '@/db'
import { user } from '@/db/schema'
import { eq, max, and, ne } from 'drizzle-orm'
import { createMemberSchema, type CreateMemberFormData } from '@/lib/validation'
import { sendEmail } from '@/lib/email-sender'
import { welcomeMemberEmailHtml } from '@/lib/invoice-email'
import { getSettings } from '@/lib/settings'

export async function createMember(
  data: CreateMemberFormData,
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin()

  const parsed = createMemberSchema.safeParse(data)
  if (!parsed.success) return { success: false, error: 'Validation failed' }

  const normalizedEmail = parsed.data.email.toLowerCase()

  // Check email uniqueness
  const existingEmail = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, normalizedEmail))
    .then((r) => r[0])

  if (existingEmail) return { success: false, error: 'emailInUse' }

  const id = crypto.randomUUID()
  const name = `${parsed.data.firstName} ${parsed.data.lastName}`

  // Use provided member number or auto-assign next
  let memberNumber: number
  if (parsed.data.memberNumber && parsed.data.memberNumber.trim() !== '') {
    memberNumber = parseInt(parsed.data.memberNumber, 10)
    if (isNaN(memberNumber) || memberNumber < 1) {
      return { success: false, error: 'Invalid member number' }
    }
    // Check uniqueness
    const existingNum = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.memberNumber, memberNumber))
      .then((r) => r[0])
    if (existingNum) return { success: false, error: 'memberNumberInUse' }
  } else {
    const [{ maxNum }] = await db
      .select({ maxNum: max(user.memberNumber) })
      .from(user)
    memberNumber = (maxNum ?? 0) + 1
  }

  await db.insert(user).values({
    id,
    name,
    email: normalizedEmail,
    emailVerified: false,
    role: 'user',
    status: 'active',
    memberNumber,
    memberSince: new Date(),
    firstName: parsed.data.firstName,
    lastName: parsed.data.lastName,
    phone: parsed.data.phone || null,
    municipality: parsed.data.municipality || null,
    dateOfBirth: parsed.data.dateOfBirth || null,
  })

  // Send welcome email
  try {
    const settings = await getSettings()
    const fromAddress = settings.email
      ? `${settings.name} <${settings.email}>`
      : `${settings.name} <noreply@obws.fi>`
    await sendEmail({
      from: fromAddress,
      to: parsed.data.email,
      subject: 'Welcome / Välkommen / Tervetuloa',
      html: welcomeMemberEmailHtml({ firstName: parsed.data.firstName, memberNumber }, settings),
    })
  } catch {
    // Don't fail member creation if email fails
    console.error('Failed to send welcome email')
  }

  revalidatePath('/members/admin/members')
  return { success: true }
}

export async function updateMember(
  userId: string,
  data: CreateMemberFormData,
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin()

  const parsed = createMemberSchema.safeParse(data)
  if (!parsed.success) return { success: false, error: 'Validation failed' }

  const normalizedEmail = parsed.data.email.toLowerCase()

  // Check email uniqueness (excluding current user)
  const existingEmail = await db
    .select({ id: user.id })
    .from(user)
    .where(and(eq(user.email, normalizedEmail), ne(user.id, userId)))
    .then((r) => r[0])
  if (existingEmail) return { success: false, error: 'emailInUse' }

  // Parse and validate member number
  let memberNumber: number | undefined
  if (parsed.data.memberNumber && parsed.data.memberNumber.trim() !== '') {
    memberNumber = parseInt(parsed.data.memberNumber, 10)
    if (isNaN(memberNumber) || memberNumber < 1) {
      return { success: false, error: 'Invalid member number' }
    }
    // Check uniqueness (excluding current user)
    const existingNum = await db
      .select({ id: user.id })
      .from(user)
      .where(and(eq(user.memberNumber, memberNumber), ne(user.id, userId)))
      .then((r) => r[0])
    if (existingNum) return { success: false, error: 'memberNumberInUse' }
  }

  await db
    .update(user)
    .set({
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      name: `${parsed.data.firstName} ${parsed.data.lastName}`,
      email: normalizedEmail,
      ...(memberNumber !== undefined && { memberNumber }),
      phone: parsed.data.phone || null,
      municipality: parsed.data.municipality || null,
      dateOfBirth: parsed.data.dateOfBirth || null,
      updatedAt: new Date(),
    })
    .where(eq(user.id, userId))

  revalidatePath('/members/admin/members')
  revalidatePath(`/members/admin/members/${userId}`)
  return { success: true }
}

export async function toggleAdmin(
  userId: string,
): Promise<{ success: boolean; error?: string }> {
  const admin = await requireAdmin()

  // Prevent removing your own admin rights
  if (admin.id === userId) return { success: false, error: 'cannotChangeOwnRole' }

  const target = await db.select({ role: user.role }).from(user).where(eq(user.id, userId)).then((r) => r[0])
  if (!target) return { success: false, error: 'Not found' }

  const newRole = target.role === 'admin' ? 'user' : 'admin'
  await db.update(user).set({ role: newRole, updatedAt: new Date() }).where(eq(user.id, userId))

  revalidatePath('/members/admin/members')
  revalidatePath(`/members/admin/members/${userId}`)
  return { success: true }
}

export async function deactivateMember(
  userId: string,
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin()

  await db
    .update(user)
    .set({ status: 'inactive', resignedAt: new Date(), updatedAt: new Date() })
    .where(eq(user.id, userId))

  revalidatePath('/members/admin/members')
  revalidatePath(`/members/admin/members/${userId}`)
  return { success: true }
}

export async function reactivateMember(
  userId: string,
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin()

  await db
    .update(user)
    .set({ status: 'active', resignedAt: null, updatedAt: new Date() })
    .where(eq(user.id, userId))

  revalidatePath('/members/admin/members')
  revalidatePath(`/members/admin/members/${userId}`)
  return { success: true }
}
