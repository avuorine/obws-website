import { getTranslations } from 'next-intl/server'
import { sendEmail } from './email-sender'
import { getSettings } from './settings'
import { getLocalized } from './localize'
import type { LocalizedText } from '@/db/schema'
import { formatDateTime } from './format-date'
import { bindingRule } from './event-deadlines'

interface ConfirmationEvent {
  id: string
  titleLocales: LocalizedText
  locationLocales: LocalizedText | null
  date: Date
  price: string | null
  cancellationAllowed: boolean | null
  cancellationDeadline: Date | null
  registrationDeadline: Date | null
}

interface ConfirmationData {
  to: string
  firstName: string
  locale: string
  event: ConfirmationEvent
  status: 'registered' | 'waitlisted' | 'pending'
  seats: number
  /** A guest was added to an existing registration. */
  guestAdded?: boolean
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/**
 * Written record of a signup and its binding terms, in the member's
 * current locale. Never throws: a failed email must not undo the signup.
 */
export async function sendRegistrationConfirmation(data: ConfirmationData): Promise<void> {
  try {
    const { event, locale } = data
    const t = await getTranslations({ locale, namespace: 'registrationEmail' })
    const tEvents = await getTranslations({ locale, namespace: 'events' })
    const settings = await getSettings()
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? ''

    const title = getLocalized(event.titleLocales, locale)
    const price = event.price != null && Number(event.price) > 0 ? event.price : null
    const rule = bindingRule(event)
    const ruleText = tEvents(`bindingRule_${rule}`, {
      paid: price ? 'yes' : 'no',
      price: price ?? '',
      deadline: event.cancellationDeadline ? formatDateTime(event.cancellationDeadline, locale) : '',
    })

    const rows: [string, string][] = [
      [tEvents('date'), formatDateTime(event.date, locale)],
      ...(event.locationLocales ? [[tEvents('location'), getLocalized(event.locationLocales, locale)] as [string, string]] : []),
      [t('seats'), String(data.seats)],
      ...(price ? [[tEvents('price'), `${price} € / ${tEvents('perPerson')}`] as [string, string]] : []),
      ...(event.cancellationDeadline
        ? [[tEvents('cancellationDeadline'), formatDateTime(event.cancellationDeadline, locale)] as [string, string]]
        : []),
    ]

    const intro = data.guestAdded ? t('guestAdded', { seats: data.seats }) : t(`intro_${data.status}`, { title })
    const eventUrl = `${siteUrl}/members/events/${event.id}`
    const hr = '<hr style="border: none; border-top: 1px solid #d4c4a8; margin: 20px 0;" />'

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #492a0d;">
        <img src="${siteUrl}/ows_logo_small.png" alt="${escapeHtml(settings.name)}" width="120" style="display: block; margin: 0 auto 16px;" />
        <h2 style="color: #492a0d;">${escapeHtml(title)}</h2>
        <p>${escapeHtml(t('greeting', { name: data.firstName }))}</p>
        <p>${escapeHtml(intro)}</p>
        <table style="border-collapse: collapse; margin: 16px 0;">
          ${rows
            .map(
              ([label, value]) =>
                `<tr><td style="padding: 4px 16px 4px 0; font-weight: bold;">${escapeHtml(label)}</td><td style="padding: 4px 0;">${escapeHtml(value)}</td></tr>`,
            )
            .join('')}
        </table>
        ${data.status !== 'registered' && !data.guestAdded ? `<p>${escapeHtml(tEvents(data.status === 'pending' ? 'bindingLotteryIntro' : 'bindingWaitlistIntro'))}</p>` : ''}
        <p style="background: #f5ead2; border: 1px solid #d4c4a8; border-radius: 8px; padding: 12px;"><strong>${escapeHtml(ruleText)}</strong></p>
        <p><a href="${eventUrl}" style="color: #c4873b;">${escapeHtml(t('viewEvent'))}</a></p>
        ${hr}
        <p style="color: #6b4423; font-size: 12px;">${escapeHtml(settings.name)}</p>
      </div>
    `

    await sendEmail({
      from: settings.email ? `${settings.name} <${settings.email}>` : `${settings.name} <noreply@obws.fi>`,
      to: data.to,
      subject: data.guestAdded ? t('subjectGuest', { title }) : t(`subject_${data.status}`, { title }),
      html,
    })
  } catch (error) {
    console.error('Failed to send registration confirmation', error)
  }
}
