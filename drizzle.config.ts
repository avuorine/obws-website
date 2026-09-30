import 'dotenv/config'
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  out: './drizzle',
  schema: './src/db/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    // Migrations (run in vercel-build) may use a session-mode or direct URL;
    // the app itself uses DATABASE_URL (the transaction pooler).
    url: process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL!,
  },
  casing: 'snake_case',
})
