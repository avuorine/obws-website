import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { admin, magicLink } from 'better-auth/plugins'
import { passkey } from '@better-auth/passkey'
import { nextCookies } from 'better-auth/next-js'
import { db } from '@/db'
import * as schema from '@/db/schema'
import { sendEmail } from './email-sender'
import { getSettings } from './settings'

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema,
  }),
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 min
    },
  },
  user: {
    additionalFields: {
      firstName: { type: 'string', required: false },
      lastName: { type: 'string', required: false },
      phone: { type: 'string', required: false },
      municipality: { type: 'string', required: false },
      dateOfBirth: { type: 'string', required: false },
      status: { type: 'string', required: false, defaultValue: 'active' },
      memberNumber: { type: 'number', required: false },
      memberSince: { type: 'date', required: false },
      resignedAt: { type: 'date', required: false },
    },
  },
  plugins: [
    admin(),
    nextCookies(),
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        const settings = await getSettings()
        await sendEmail({
          from: `${settings.name} <${settings.email || 'noreply@obws.fi'}>`,
          to: email,
          subject: `Logga in / Kirjaudu sisään / Sign in — ${settings.name}`,
          html: magicLinkEmailHtml(url, settings.name),
        })
      },
    }),
    passkey(),
  ],
})

function magicLinkEmailHtml(url: string, societyName: string): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL!
  const hr = '<hr style="border: none; border-top: 1px solid #d4c4a8; margin: 20px 0;" />'
  const btnStyle = 'display: inline-block; padding: 12px 24px; background-color: #d4a853; color: white; text-decoration: none; border-radius: 6px;'

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <img src="${siteUrl}/ows_logo_small.png" alt="${societyName}" width="120" style="display: block; margin: 0 auto 16px;" />
      <h2 style="color: #492a0d;">Logga in / Kirjaudu sisään / Sign in</h2>

      <!-- Swedish -->
      <p>Klicka på länken nedan för att logga in:</p>
      <p style="font-size: 12px; color: #6b4423;">Länken är giltig i 10 minuter.</p>

      ${hr}

      <!-- Finnish -->
      <p>Klikkaa alla olevaa linkkiä kirjautuaksesi sisään:</p>
      <p style="font-size: 12px; color: #6b4423;">Linkki on voimassa 10 minuuttia.</p>

      ${hr}

      <!-- English -->
      <p>Click the link below to sign in:</p>
      <p style="font-size: 12px; color: #6b4423;">This link is valid for 10 minutes.</p>

      ${hr}

      <p style="text-align: center;">
        <a href="${url}" style="${btnStyle}">Logga in / Kirjaudu / Sign in</a>
      </p>

      ${hr}
      <p style="color: #6b4423; font-size: 12px;">${societyName}</p>
    </div>
  `
}

export type Session = typeof auth.$Infer.Session
