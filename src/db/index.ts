import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { attachDatabasePool } from '@vercel/functions'
import * as schema from './schema'

// Each serverless instance gets its own pool, and the Supabase pooler caps
// total clients, so keep the pool small and drop idle connections quickly.
// attachDatabasePool keeps a Vercel instance alive long enough to close idle
// connections before it is suspended (otherwise they linger and pile up).
function createPool() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 10_000,
  })
  attachDatabasePool(pool)
  return pool
}

// Reuse one pool across hot reloads in development.
const globalForDb = globalThis as unknown as { dbPool?: Pool }
const pool = globalForDb.dbPool ?? createPool()
if (process.env.NODE_ENV !== 'production') globalForDb.dbPool = pool

export const db = drizzle({ client: pool, schema, casing: 'snake_case' })
