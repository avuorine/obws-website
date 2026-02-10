'use server'

import { eq, or, and } from 'drizzle-orm'
import { db } from '@/db'
import { user } from '@/db/schema'
import { requireAdmin } from '@/lib/admin-guard'
import { getSettings } from '@/lib/settings'
import { massEmailSchema } from '@/lib/validation'
import { massEmailHtml } from '@/lib/email'
import { sendEmail } from '@/lib/email-sender'
import { resend } from '@/lib/resend'
import { generateUnsubscribeUrl } from '@/lib/unsubscribe'

async function extractAttachments(formData: FormData) {
  const files = formData.getAll('attachments') as File[]
  return Promise.all(
    files
      .filter((f) => f.size > 0)
      .map(async (file) => ({
        filename: file.name,
        content: Buffer.from(await file.arrayBuffer()),
      })),
  )
}

export async function sendTestEmail(formData: FormData) {
  const admin = await requireAdmin()
  const parsed = massEmailSchema.safeParse({
    subject: formData.get('subject'),
    message: formData.get('message'),
    recipientFilter: formData.get('recipientFilter'),
  })
  if (!parsed.success) return { success: false as const, error: 'Invalid data' }

  const settings = await getSettings()
  const html = massEmailHtml(parsed.data.subject, parsed.data.message, settings.name)
  const from = `${settings.name} <${settings.email || 'noreply@obws.fi'}>`
  const attachments = await extractAttachments(formData)

  try {
    await sendEmail({
      from,
      to: admin.email,
      subject: `[TEST] ${parsed.data.subject}`,
      html,
      attachments,
    })
    return { success: true as const }
  } catch {
    return { success: false as const, error: 'Failed to send test email' }
  }
}

export async function sendMassEmail(formData: FormData) {
  await requireAdmin()
  const parsed = massEmailSchema.safeParse({
    subject: formData.get('subject'),
    message: formData.get('message'),
    recipientFilter: formData.get('recipientFilter'),
  })
  if (!parsed.success) return { success: false as const, error: 'Invalid data' }

  const settings = await getSettings()
  const from = `${settings.name} <${settings.email || 'noreply@obws.fi'}>`
  const attachments = await extractAttachments(formData)

  const filter = parsed.data.recipientFilter
  const statusCondition =
    filter === 'active'
      ? eq(user.status, 'active')
      : filter === 'honorary'
        ? eq(user.status, 'honorary')
        : or(eq(user.status, 'active'), eq(user.status, 'honorary'))

  const members = await db
    .select({ email: user.email, id: user.id })
    .from(user)
    .where(and(statusCondition, eq(user.marketingEmails, true)))

  if (members.length === 0) return { success: true as const, count: 0 }

  try {
    if (process.env.NODE_ENV === 'development') {
      for (const member of members) {
        const unsubUrl = generateUnsubscribeUrl(member.id)
        const html = massEmailHtml(parsed.data.subject, parsed.data.message, settings.name, unsubUrl)
        await sendEmail({ from, to: member.email, subject: parsed.data.subject, html, attachments })
      }
    } else {
      // Resend batch API supports up to 100 emails per request
      const batchSize = 100
      for (let i = 0; i < members.length; i += batchSize) {
        const batch = members.slice(i, i + batchSize)
        await resend.batch.send(
          batch.map((m) => {
            const unsubUrl = generateUnsubscribeUrl(m.id)
            const html = massEmailHtml(parsed.data.subject, parsed.data.message, settings.name, unsubUrl)
            return { from, to: m.email, subject: parsed.data.subject, html, attachments }
          }),
        )
        if (i + batchSize < members.length) {
          await new Promise((r) => setTimeout(r, 500))
        }
      }
    }
    return { success: true as const, count: members.length }
  } catch {
    return { success: false as const, error: 'Failed to send emails' }
  }
}
