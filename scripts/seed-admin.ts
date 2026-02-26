/**
 * Seed the initial admin user.
 *
 * Usage:
 *   ADMIN_EMAIL=you@example.com pnpm db:seed-admin
 *   ADMIN_EMAIL=you@example.com ADMIN_NAME="Your Name" pnpm db:seed-admin
 *
 * Required env vars: DATABASE_URL
 *
 * Creates an admin user directly in the database.
 * After running, the admin can log in via magic link at /login.
 */

import 'dotenv/config'
import { drizzle } from 'drizzle-orm/node-postgres'
import { eq } from 'drizzle-orm'
import { user } from '../src/db/schema'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL
const ADMIN_NAME = process.env.ADMIN_NAME ?? 'Admin'

if (!ADMIN_EMAIL) {
  console.error('Usage: ADMIN_EMAIL=you@example.com pnpm db:seed-admin')
  process.exit(1)
}

const normalizedEmail = ADMIN_EMAIL.toLowerCase()

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL env var is required')
  process.exit(1)
}

const db = drizzle(process.env.DATABASE_URL)

async function main() {
  const existing = await db
    .select({ id: user.id, role: user.role })
    .from(user)
    .where(eq(user.email, normalizedEmail))
    .limit(1)

  if (existing.length > 0) {
    if (existing[0].role === 'admin') {
      console.log(`${ADMIN_EMAIL} is already an admin (id: ${existing[0].id})`)
      return
    }

    await db
      .update(user)
      .set({ role: 'admin' })
      .where(eq(user.email, normalizedEmail))

    console.log(`Updated ${ADMIN_EMAIL} to admin role.`)
    return
  }

  const id = crypto.randomUUID()
  await db.insert(user).values({
    id,
    name: ADMIN_NAME,
    email: normalizedEmail,
    emailVerified: true,
    role: 'admin',
    status: 'active',
    memberSince: new Date(),
  })

  console.log(`Admin user created: ${ADMIN_EMAIL} (id: ${id})`)
  console.log('Log in at /login using magic link.')
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Failed to seed admin:', err)
    process.exit(1)
  })
