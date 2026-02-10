'use server'

import { checkBotId } from 'botid/server'
import { membershipSchema, type MembershipFormData } from '@/lib/validation'
import { notificationEmailHtml, confirmationEmailHtml } from '@/lib/email'
import { sendEmail } from '@/lib/email-sender'
import { getSettings } from '@/lib/settings'

export async function submitMembership(
  data: MembershipFormData,
): Promise<{ success: boolean; error?: string }> {
  const botResult = await checkBotId()
  if (botResult.isBot) {
    return { success: false, error: 'Submission failed' }
  }

  const parsed = membershipSchema.safeParse(data)
  if (!parsed.success) {
    return { success: false, error: 'Validation failed' }
  }

  try {
    const settings = await getSettings()
    const membershipEmail = settings.email || 'members@obws.fi'

    await sendEmail({
      from: 'noreply@obws.fi',
      to: membershipEmail,
      subject: `Ny medlemsansökan: ${parsed.data.firstName} ${parsed.data.lastName}`,
      html: notificationEmailHtml(parsed.data, settings.name),
    })

    await sendEmail({
      from: 'noreply@obws.fi',
      to: parsed.data.email,
      subject: 'Österbottens Whiskysällskap — Medlemsansökan / Jäsenhakemus / Membership application',
      html: confirmationEmailHtml(parsed.data, settings.name),
    })

    return { success: true }
  } catch (error) {
    console.error('Failed to send membership emails:', error)
    return { success: false, error: 'Failed to send email' }
  }
}
