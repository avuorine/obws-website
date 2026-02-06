'use server'

import { getPayloadHMR } from '@payloadcms/next/utilities'
import configPromise from '@payload-config'
import { membershipSchema, type MembershipFormData } from '@/lib/validation'
import { notificationEmailHtml, confirmationEmailHtml } from '@/lib/email'

export async function submitMembership(
  data: MembershipFormData,
): Promise<{ success: boolean; error?: string }> {
  const parsed = membershipSchema.safeParse(data)
  if (!parsed.success) {
    return { success: false, error: 'Validation failed' }
  }

  try {
    const payload = await getPayloadHMR({ config: configPromise })
    const membershipEmail = process.env.MEMBERSHIP_EMAIL || 'members@obws.fi'

    await payload.sendEmail({
      to: membershipEmail,
      subject: `Ny medlemsansökan: ${parsed.data.firstName} ${parsed.data.lastName}`,
      html: notificationEmailHtml(parsed.data),
    })

    await payload.sendEmail({
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
