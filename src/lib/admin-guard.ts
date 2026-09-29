import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from './auth'

/**
 * Admin check for pages, route handlers and server actions. Call it in each
 * one rather than relying on the admin layout: layouts don't re-run on
 * client navigation. Bypasses the 5-minute session cookie cache so a
 * revoked admin role takes effect on the next request.
 */
export async function requireAdmin() {
  const session = await auth.api.getSession({
    headers: await headers(),
    query: { disableCookieCache: true },
  })
  const member = session?.user ?? null
  if (!member || member.role !== 'admin') redirect('/members')
  return member
}
