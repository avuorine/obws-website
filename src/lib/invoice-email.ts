import { ASSOCIATION_TIMEZONE, formatBarcodeDateInTz } from './timezone'

/**
 * Finnish virtual barcode (virtuaaliviivakoodi) version 4.
 * 54-digit numeric string: version(1) + IBAN(16) + euros(6) + cents(2) + reserved(3) + reference(20) + dueDate(6)
 */
function generateVirtualBarcode(iban: string, amount: string, referenceNumber: string, dueDate: Date): string {
  const version = '4'
  // Strip "FI" prefix and spaces from IBAN → 16 digits
  const ibanDigits = iban.replace(/\s/g, '').replace(/^FI/i, '').padStart(16, '0')
  // Amount: split into euros and cents, zero-pad to 6+2 digits
  const [eurosStr, centsStr = '0'] = amount.split('.')
  const euros = eurosStr.padStart(6, '0')
  const cents = centsStr.padEnd(2, '0').slice(0, 2)
  const reserved = '000'
  // Reference number: strip spaces, zero-pad to 20 digits
  const ref = referenceNumber.replace(/\s/g, '').padStart(20, '0')
  // Due date: YYMMDD in association timezone
  const { yy, mm, dd } = formatBarcodeDateInTz(dueDate)

  return `${version}${ibanDigits}${euros}${cents}${reserved}${ref}${yy}${mm}${dd}`
}

interface InvoiceEmailSettings {
  name: string
  iban: string | null
}

export function invoiceEmailHtml(invoice: {
  invoiceNumber: number
  recipientName: string
  description: string
  amount: string
  dueDate: Date
  referenceNumber: string
}, settings: InvoiceEmailSettings): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL!
  const societyName = settings.name
  const societyIban = settings.iban || ''
  const dueDateStr = invoice.dueDate.toLocaleDateString('fi-FI', { timeZone: ASSOCIATION_TIMEZONE })
  const hr = '<hr style="border: none; border-top: 1px solid #d4c4a8; margin: 20px 0;" />'
  const barcode = societyIban
    ? generateVirtualBarcode(societyIban, invoice.amount, invoice.referenceNumber, invoice.dueDate)
    : ''

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <img src="${siteUrl}/ows_logo_small.png" alt="${societyName}" width="120" style="display: block; margin: 0 auto 16px;" />
      <h2 style="color: #492a0d;">Faktura / Lasku / Invoice #${invoice.invoiceNumber}</h2>

      <!-- Swedish -->
      <p>Hej ${invoice.recipientName},</p>
      <p>Bifogat finner du faktura #${invoice.invoiceNumber}.</p>

      ${hr}

      <!-- Finnish -->
      <p>Hei ${invoice.recipientName},</p>
      <p>Löydät laskun #${invoice.invoiceNumber} liitteenä.</p>

      ${hr}

      <!-- English -->
      <p>Hi ${invoice.recipientName},</p>
      <p>Please find attached invoice #${invoice.invoiceNumber}.</p>

      ${hr}

      <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
        <tr><td style="padding: 6px 0; font-weight: bold; color: #492a0d;">Beskrivning / Kuvaus / Description</td><td style="padding: 6px 0;">${invoice.description}</td></tr>
        <tr><td style="padding: 6px 0; font-weight: bold; color: #492a0d;">Summa / Summa / Amount</td><td style="padding: 6px 0;">€${invoice.amount}</td></tr>
        <tr><td style="padding: 6px 0; font-weight: bold; color: #492a0d;">Förfallodag / Eräpäivä / Due date</td><td style="padding: 6px 0;">${dueDateStr}</td></tr>
        <tr><td style="padding: 6px 0; font-weight: bold; color: #492a0d;">Referensnummer / Viitenumero / Reference</td><td style="padding: 6px 0;">${invoice.referenceNumber}</td></tr>
      </table>
${barcode ? `
      ${hr}
      <p style="font-weight: bold; color: #492a0d; font-size: 13px;">Virtuaaliviivakoodi / Virtual barcode:</p>
      <p style="font-family: 'Courier New', Courier, monospace; font-size: 14px; letter-spacing: 1px; background: #f5f0e8; padding: 10px; border-radius: 4px; word-break: break-all;">${barcode}</p>
` : ''}
      ${hr}
      <p style="color: #6b4423; font-size: 12px;">${societyName}</p>
    </div>
  `
}

interface WelcomeEmailData {
  firstName: string
  memberNumber: number
}

interface WelcomeEmailSettings {
  name: string
}

export function welcomeMemberEmailHtml(data: WelcomeEmailData, settings: WelcomeEmailSettings): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL!
  const societyName = settings.name
  const loginUrl = `${siteUrl}/login`
  const hr = '<hr style="border: none; border-top: 1px solid #d4c4a8; margin: 20px 0;" />'
  const labelStyle = 'style="color: #492a0d; font-weight: bold; font-size: 14px;"'
  const numStyle = 'style="font-size: 24px; font-weight: bold; color: #492a0d;"'

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <img src="${siteUrl}/ows_logo_small.png" alt="${societyName}" width="120" style="display: block; margin: 0 auto 16px;" />
      <h2 style="color: #492a0d;">Välkommen / Tervetuloa / Welcome</h2>

      <!-- Swedish -->
      <p>Hej ${data.firstName},</p>
      <p>Välkommen som medlem i ${societyName}!</p>
      <p ${labelStyle}>Ditt medlemsnummer:</p>
      <p ${numStyle}>${data.memberNumber}</p>
      <p><strong>Så loggar du in:</strong></p>
      <ol>
        <li>Gå till <a href="${loginUrl}" style="color: #d4a853;">${loginUrl}</a></li>
        <li>Ange din e-postadress</li>
        <li>Kolla din inkorg efter en inloggningslänk (giltig i 10 minuter)</li>
        <li>Klicka på länken för att logga in</li>
      </ol>
      <p><strong>Tips:</strong> Efter din första inloggning kan du registrera en passkey (t.ex. fingeravtryck eller Face ID) i din profil för snabbare inloggning i framtiden.</p>
      <p>I medlemsområdet kan du anmäla dig till evenemang och hantera din profil.</p>

      ${hr}

      <!-- Finnish -->
      <p>Hei ${data.firstName},</p>
      <p>Tervetuloa ${societyName}:n jäseneksi!</p>
      <p ${labelStyle}>Jäsennumerosi:</p>
      <p ${numStyle}>${data.memberNumber}</p>
      <p><strong>Näin kirjaudut sisään:</strong></p>
      <ol>
        <li>Siirry osoitteeseen <a href="${loginUrl}" style="color: #d4a853;">${loginUrl}</a></li>
        <li>Syötä sähköpostiosoitteesi</li>
        <li>Tarkista sähköpostisi – saat kirjautumislinkin (voimassa 10 minuuttia)</li>
        <li>Klikkaa linkkiä kirjautuaksesi sisään</li>
      </ol>
      <p><strong>Vinkki:</strong> Ensimmäisen kirjautumisen jälkeen voit rekisteröidä pääsyavaimen (esim. sormenjälki tai Face ID) profiilissasi nopeampaa kirjautumista varten.</p>
      <p>Jäsenalueella voit ilmoittautua tapahtumiin ja hallita profiiliasi.</p>

      ${hr}

      <!-- English -->
      <p>Hi ${data.firstName},</p>
      <p>Welcome as a member of ${societyName}!</p>
      <p ${labelStyle}>Your member number:</p>
      <p ${numStyle}>${data.memberNumber}</p>
      <p><strong>How to sign in:</strong></p>
      <ol>
        <li>Go to <a href="${loginUrl}" style="color: #d4a853;">${loginUrl}</a></li>
        <li>Enter your email address</li>
        <li>Check your inbox for a login link (valid for 10 minutes)</li>
        <li>Click the link to sign in</li>
      </ol>
      <p><strong>Tip:</strong> After your first login, you can register a passkey (e.g. fingerprint or Face ID) in your profile for faster sign-in in the future.</p>
      <p>In the members area you can sign up for events and manage your profile.</p>

      ${hr}
      <p style="color: #6b4423; font-size: 12px;">${societyName}</p>
    </div>
  `
}
