import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { admin, magicLink } from 'better-auth/plugins'
import { passkey } from '@better-auth/passkey'
import { nextCookies } from 'better-auth/next-js'
import { db } from '@/db'
import * as schema from '@/db/schema'
import { resend } from './resend'

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
      memberSince: { type: 'date', required: false },
    },
  },
  plugins: [
    admin(),
    nextCookies(),
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        await resend.emails.send({
          from: 'noreply@obws.fi',
          to: email,
          subject: 'Logga in / Sign in — OWS rf.',
          html: magicLinkEmailHtml(url),
        })
      },
    }),
    passkey(),
  ],
})

function magicLinkEmailHtml(url: string): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #492a0d;">Logga in / Sign In</h2>
      <p>Klicka på länken nedan för att logga in:</p>
      <p><a href="${url}" style="display: inline-block; padding: 12px 24px; background-color: #d4a853; color: white; text-decoration: none; border-radius: 6px;">Logga in / Sign in</a></p>
      <p style="font-size: 12px; color: #6b4423;">Denna länk är giltig i 10 minuter. / This link is valid for 10 minutes.</p>
      <hr style="border: none; border-top: 1px solid #d4c4a8; margin: 20px 0;" />
      <p style="color: #6b4423; font-size: 12px;">Österbottens Whiskysällskap rf.</p>
    </div>
  `
}

export type Session = typeof auth.$Infer.Session
