import { db } from '../../src/db'
import { user, account } from '../../src/db/schema'
import { eq } from 'drizzle-orm'

export const testUser = {
  email: 'test@obws.fi',
  password: 'testpassword',
  name: 'Test User',
}

export async function seedTestUser(): Promise<void> {
  await db.delete(user).where(eq(user.email, testUser.email))

  await db.insert(user).values({
    id: 'test-user-id',
    name: testUser.name,
    email: testUser.email,
    emailVerified: true,
    firstName: 'Test',
    lastName: 'User',
    status: 'active',
  })
}

export async function cleanupTestUser(): Promise<void> {
  await db.delete(account).where(eq(account.userId, 'test-user-id'))
  await db.delete(user).where(eq(user.email, testUser.email))
}
