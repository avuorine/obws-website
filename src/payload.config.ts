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
      connectionString: process.env.DATABASE_URL || '',
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
