import { postgresAdapter } from '@payloadcms/db-postgres'
import { resendAdapter } from '@payloadcms/email-resend'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { Users } from './collections/Users'
import { Media } from './collections/Media'
import { SiteSettings } from './globals/SiteSettings'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

function getConnectionString() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || ''
  if (!url || process.env.NODE_ENV !== 'production') return url
  // Add sslmode=no-verify for Supabase (self-signed cert) and silence pg warning
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}sslmode=no-verify`
}

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [Users, Media],
  globals: [SiteSettings],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString: getConnectionString(),
    },
  }),
  email: resendAdapter({
    defaultFromAddress: 'noreply@obws.fi',
    defaultFromName: 'Österbottens Whiskysällskap',
    apiKey: process.env.RESEND_API_KEY || '',
  }),
  localization: {
    locales: [
      { label: 'Svenska', code: 'sv' },
      { label: 'Suomi', code: 'fi' },
      { label: 'English', code: 'en' },
    ],
    defaultLocale: 'sv',
  },
  sharp,
  plugins: [],
})
