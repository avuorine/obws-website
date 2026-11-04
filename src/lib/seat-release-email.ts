import { sendEmail } from './email-sender'
import { getSettings } from './settings'
import { getLocalized } from './localize'
import { ASSOCIATION_TIMEZONE } from './timezone'
import type { LocalizedText } from '@/db/schema'

// Trilingual like the invoice emails: the nightly job has no member locale.

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const day = (d: Date) => d.toLocaleDateString('fi-FI', { timeZone: ASSOCIATION_TIMEZONE })

async function send(to: string, subject: string, heading: string, sections: { sv: string[]; fi: string[]; en: string[] }) {
  const settings = await getSettings()
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? ''
  const hr = '<hr style="border: none; border-top: 1px solid #d4c4a8; margin: 20px 0;" />'
  const block = (lines: string[]) => lines.map((l) => `<p>${l}</p>`).join('')
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #492a0d;">
      <img src="${siteUrl}/ows_logo_small.png" alt="${escapeHtml(settings.name)}" width="120" style="display: block; margin: 0 auto 16px;" />
      <h2 style="color: #492a0d;">${heading}</h2>
      ${block(sections.sv)}
      ${hr}
      ${block(sections.fi)}
      ${hr}
      ${block(sections.en)}
      ${hr}
      <p><a href="${siteUrl}/members/invoices" style="color: #c4873b;">${siteUrl}/members/invoices</a></p>
      <p style="color: #6b4423; font-size: 12px;">${escapeHtml(settings.name)}${settings.email ? ` · ${escapeHtml(settings.email)}` : ''}</p>
    </div>
  `
  await sendEmail({
    from: settings.email ? `${settings.name} <${settings.email}>` : `${settings.name} <noreply@obws.fi>`,
    to,
    subject,
    html,
  })
}

interface ReminderData {
  to: string
  name: string
  eventTitle: LocalizedText
  invoiceNumber: number
  remaining: number
  referenceNumber: string
  seatReleaseAt: Date | null
}

/**
 * Sent on the last banking day of a binding invoice's payment window. With
 * `seatReleaseAt` the seat is released at the end of that day; without it
 * (late signups) the seat is kept but the fee is still owed.
 */
export async function sendPaymentReminder(d: ReminderData): Promise<void> {
  const t = (l: 'sv' | 'fi' | 'en') => escapeHtml(getLocalized(d.eventTitle, l))
  const name = escapeHtml(d.name)
  const amount = d.remaining.toFixed(2)
  const release = d.seatReleaseAt ? day(d.seatReleaseAt) : null
  await send(
    d.to,
    `Påminnelse / Muistutus / Reminder: #${d.invoiceNumber}`,
    `Påminnelse / Muistutus / Reminder #${d.invoiceNumber}`,
    {
      sv: [
        `Hej ${name},`,
        `Faktura #${d.invoiceNumber} för ${t('sv')} är fortfarande obetald. Att betala: ${amount} €, referensnummer ${d.referenceNumber}.`,
        release
          ? `Betala i dag (${release}). Är fakturan fortfarande obetald efter det frigörs din plats och erbjuds till väntelistan.`
          : 'Betala fakturan så snart som möjligt. Anmälan är bindande och avgiften ska betalas även om du inte kan delta.',
        'Har du redan betalat kan du bortse från detta meddelande.',
      ],
      fi: [
        `Hei ${name},`,
        `Tapahtuman ${t('fi')} lasku #${d.invoiceNumber} on yhä maksamatta. Maksettavaa: ${amount} €, viitenumero ${d.referenceNumber}.`,
        release
          ? `Maksathan tänään (${release}). Jos lasku on sen jälkeen yhä maksamatta, paikkasi vapautetaan jonotuslistalle.`
          : 'Maksathan laskun mahdollisimman pian. Ilmoittautuminen on sitova, ja maksu on maksettava, vaikka et pääsisi paikalle.',
        'Jos olet jo maksanut, voit jättää tämän viestin huomiotta.',
      ],
      en: [
        `Hi ${name},`,
        `Invoice #${d.invoiceNumber} for ${t('en')} is still unpaid. Amount due: ${amount} €, reference ${d.referenceNumber}.`,
        release
          ? `Please pay today (${release}). If the invoice is still unpaid after that, your seat is released and offered to the waitlist.`
          : 'Please pay the invoice as soon as possible. Your registration is binding and the fee is owed even if you cannot attend.',
        'If you have already paid, you can ignore this message.',
      ],
    },
  )
}

interface ReleasedData {
  to: string
  name: string
  eventTitle: LocalizedText
  invoiceNumber: number
  /** The whole registration was released, or only guest seats. */
  kind: 'registration' | 'guests'
}

/** Sent when an unpaid binding invoice's seats have been released. */
export async function sendSeatReleased(d: ReleasedData): Promise<void> {
  const t = (l: 'sv' | 'fi' | 'en') => escapeHtml(getLocalized(d.eventTitle, l))
  const name = escapeHtml(d.name)
  const guests = d.kind === 'guests'
  await send(
    d.to,
    `Plats frigjord / Paikka vapautettu / Seat released: ${getLocalized(d.eventTitle, 'en')}`,
    `${t('sv')}`,
    {
      sv: [
        `Hej ${name},`,
        `Eftersom faktura #${d.invoiceNumber} för ${t('sv')} inte betalades har ${guests ? 'gästplatsen' : 'din plats'} frigjorts och fakturan annullerats. Du behöver inte betala den.`,
        'Har du betalat nyligen, kontakta oss så reder vi ut det.',
      ],
      fi: [
        `Hei ${name},`,
        `Koska tapahtuman ${t('fi')} laskua #${d.invoiceNumber} ei maksettu, ${guests ? 'vieraspaikka' : 'paikkasi'} on vapautettu ja lasku on peruttu. Sinun ei tarvitse maksaa sitä.`,
        'Jos maksoit äskettäin, ota yhteyttä, niin selvitämme asian.',
      ],
      en: [
        `Hi ${name},`,
        `Because invoice #${d.invoiceNumber} for ${t('en')} was not paid, ${guests ? 'the guest seat has' : 'your seat has'} been released and the invoice cancelled. You do not need to pay it.`,
        'If you paid recently, please contact us and we will sort it out.',
      ],
    },
  )
}
