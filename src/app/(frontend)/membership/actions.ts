'use server'

import { Resend } from 'resend'
import { checkBotId } from 'botid/server'
import { membershipSchema, type MembershipFormData } from '@/lib/validation'
import { notificationEmailHtml, confirmationEmailHtml } from '@/lib/email'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function submitMembership(
  data: MembershipFormData,
): Promise<{ success: boolean; error?: string }> {
  // Bot detection - hard block bots
  const botResult = await checkBotId()
  if (botResult.isBot) {
    return { success: false, error: 'Submission failed' }
  }

  const parsed = membershipSchema.safeParse(data)
  if (!parsed.success) {
    return { success: false, error: 'Validation failed' }
  }

  try {
    const membershipEmail = process.env.MEMBERSHIP_EMAIL || 'members@obws.fi'

    await resend.emails.send({
      from: 'Österbottens Whiskysällskap <noreply@obws.fi>',
      to: membershipEmail,
      subject: `Ny medlemsansökan: ${parsed.data.firstName} ${parsed.data.lastName}`,
      html: notificationEmailHtml(parsed.data),
    })

    await resend.emails.send({
      from: 'Österbottens Whiskysällskap <noreply@obws.fi>',
      to: parsed.data.email,
      subject: 'Medlemsansökan mottagen / Application received — OWS rf.',
      html: confirmationEmailHtml(parsed.data),
    })

    return { success: true }
  } catch (error) {
    console.error('Failed to send membership emails:', error)
    return { success: false, error: 'Failed to send email' }
  }
}
