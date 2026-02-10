import 'dotenv/config'
import { drizzle } from 'drizzle-orm/node-postgres'
import { invoiceCounter } from '../src/db/schema'

const db = drizzle(process.env.DATABASE_URL!)

async function main() {
  const existing = await db.select().from(invoiceCounter)
  if (existing.length === 0) {
    await db.insert(invoiceCounter).values({ nextNumber: 1 })
    console.log('Invoice counter seeded with nextNumber=1')
  } else {
    console.log('Invoice counter already exists, skipping')
  }
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
