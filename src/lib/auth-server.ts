import { headers } from 'next/headers'
import { auth } from './auth'

export async function getSession() {
  return auth.api.getSession({ headers: await headers() })
}

export async function getMember() {
  const session = await getSession()
  return session?.user ?? null
}
