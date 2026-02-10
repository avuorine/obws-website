/**
 * Seed default event categories.
 *
 * Usage:
 *   pnpm db:seed-categories
 *
 * Required env vars: DATABASE_URL
 */

import 'dotenv/config'
import { drizzle } from 'drizzle-orm/node-postgres'
import { eventCategories } from '../src/db/schema'

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL env var is required')
  process.exit(1)
}

const db = drizzle(process.env.DATABASE_URL)

const categories = [
  { slug: 'tasting', nameLocales: { sv: 'Provning', fi: 'Maistelu', en: 'Tasting' }, sortOrder: 0 },
  { slug: 'social', nameLocales: { sv: 'Social', fi: 'Sosiaalinen', en: 'Social' }, sortOrder: 1 },
  { slug: 'trip', nameLocales: { sv: 'Resa', fi: 'Matka', en: 'Trip' }, sortOrder: 2 },
  { slug: 'meeting', nameLocales: { sv: 'Möte', fi: 'Kokous', en: 'Meeting' }, sortOrder: 3 },
  { slug: 'other', nameLocales: { sv: 'Övrigt', fi: 'Muu', en: 'Other' }, sortOrder: 4 },
]

async function main() {
  for (const cat of categories) {
    await db
      .insert(eventCategories)
      .values(cat)
      .onConflictDoNothing({ target: eventCategories.slug })
  }
  console.log(`Seeded ${categories.length} event categories.`)
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Failed to seed categories:', err)
    process.exit(1)
  })
