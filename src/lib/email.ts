import type { MembershipFormData } from './validation'

export function notificationEmailHtml(data: MembershipFormData): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #492a0d;">Ny medlemsansökan / New Membership Application</h2>
      <table style="width: 100%; border-collapse: collapse;">
        <tr><td style="padding: 8px; border-bottom: 1px solid #d4c4a8; font-weight: bold;">Namn / Name</td><td style="padding: 8px; border-bottom: 1px solid #d4c4a8;">${data.firstName} ${data.lastName}</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #d4c4a8; font-weight: bold;">E-post / Email</td><td style="padding: 8px; border-bottom: 1px solid #d4c4a8;">${data.email}</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #d4c4a8; font-weight: bold;">Telefon / Phone</td><td style="padding: 8px; border-bottom: 1px solid #d4c4a8;">${data.phone}</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #d4c4a8; font-weight: bold;">Kommun / Municipality</td><td style="padding: 8px; border-bottom: 1px solid #d4c4a8;">${data.municipality}</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #d4c4a8; font-weight: bold;">Födelsedatum / Date of birth</td><td style="padding: 8px; border-bottom: 1px solid #d4c4a8;">${data.dateOfBirth}</td></tr>
      </table>
    </div>
  `
}

export function confirmationEmailHtml(data: MembershipFormData): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #492a0d;">Tack för din ansökan! / Thank you for your application!</h2>
      <p>Hej ${data.firstName},</p>
      <p>Vi har tagit emot din medlemsansökan till Österbottens Whiskysällskap rf. Vi återkommer till dig inom kort.</p>
      <hr style="border: none; border-top: 1px solid #d4c4a8; margin: 20px 0;" />
      <p>Hi ${data.firstName},</p>
      <p>We have received your membership application for Österbottens Whiskysällskap rf. We will get back to you shortly.</p>
      <hr style="border: none; border-top: 1px solid #d4c4a8; margin: 20px 0;" />
      <p style="color: #6b4423; font-size: 12px;">Österbottens Whiskysällskap rf.</p>
    </div>
  `
}
