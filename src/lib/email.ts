import type { MembershipFormData } from './validation'

const hr = '<hr style="border: none; border-top: 1px solid #d4c4a8; margin: 20px 0;" />'

export function massEmailHtml(subject: string, bodyHtml: string, societyName: string, unsubscribeUrl?: string): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL!
  const unsubscribeBlock = unsubscribeUrl
    ? `<p style="color: #999; font-size: 11px; margin-top: 12px;"><a href="${unsubscribeUrl}" style="color: #999; text-decoration: underline;">Avregistrera / Peruuta tilaus / Unsubscribe</a></p>`
    : ''
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <img src="${siteUrl}/ows_logo_small.png" alt="${societyName}" width="120" style="display: block; margin: 0 auto 16px;" />
      <h2 style="color: #492a0d;">${subject}</h2>
      ${bodyHtml}
      ${hr}
      <p style="color: #6b4423; font-size: 12px;">${societyName}</p>
      ${unsubscribeBlock}
    </div>
  `
}

function logoHtml(societyName: string): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL!
  return `<img src="${siteUrl}/ows_logo_small.png" alt="${societyName}" width="120" style="display: block; margin: 0 auto 16px;" />`
}

export function notificationEmailHtml(data: MembershipFormData, societyName: string): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      ${logoHtml(societyName)}
      <h2 style="color: #492a0d;">Ny medlemsansökan / Uusi jäsenhakemus / New Membership Application</h2>
      <table style="width: 100%; border-collapse: collapse;">
        <tr><td style="padding: 8px; border-bottom: 1px solid #d4c4a8; font-weight: bold;">Namn / Nimi / Name</td><td style="padding: 8px; border-bottom: 1px solid #d4c4a8;">${data.firstName} ${data.lastName}</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #d4c4a8; font-weight: bold;">E-post / Sähköposti / Email</td><td style="padding: 8px; border-bottom: 1px solid #d4c4a8;">${data.email}</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #d4c4a8; font-weight: bold;">Telefon / Puhelin / Phone</td><td style="padding: 8px; border-bottom: 1px solid #d4c4a8;">${data.phone}</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #d4c4a8; font-weight: bold;">Kommun / Kunta / Municipality</td><td style="padding: 8px; border-bottom: 1px solid #d4c4a8;">${data.municipality}</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #d4c4a8; font-weight: bold;">Födelsedatum / Syntymäaika / Date of birth</td><td style="padding: 8px; border-bottom: 1px solid #d4c4a8;">${data.dateOfBirth}</td></tr>
      </table>
      ${hr}
      <p style="color: #6b4423; font-size: 12px;">${societyName}</p>
    </div>
  `
}

export function confirmationEmailHtml(data: MembershipFormData, societyName: string): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      ${logoHtml(societyName)}
      <h2 style="color: #492a0d;">Tack för din ansökan! / Kiitos hakemuksestasi! / Thank you for your application!</h2>

      <!-- Swedish -->
      <p>Hej ${data.firstName},</p>
      <p>Vi har tagit emot din medlemsansökan till ${societyName}. Din ansökan behandlas vid nästa styrelsemöte. Du får ett meddelande när ansökan har behandlats.</p>

      ${hr}

      <!-- Finnish -->
      <p>Hei ${data.firstName},</p>
      <p>Olemme vastaanottaneet jäsenhakemuksesi ${societyName}:iin. Hakemuksesi käsitellään seuraavassa hallituksen kokouksessa. Saat ilmoituksen, kun hakemus on käsitelty.</p>

      ${hr}

      <!-- English -->
      <p>Hi ${data.firstName},</p>
      <p>We have received your membership application for ${societyName}. Your application will be processed at the next board meeting. You will be notified once your application has been reviewed.</p>

      ${hr}
      <p style="color: #6b4423; font-size: 12px;">${societyName}</p>
    </div>
  `
}
