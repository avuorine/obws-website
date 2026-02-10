import { redirect } from 'next/navigation'
import { getMember } from './auth-server'

export async function requireAdmin() {
  const member = await getMember()
  if (!member || member.role !== 'admin') redirect('/members')
  return member
}
