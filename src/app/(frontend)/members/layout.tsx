import { redirect } from 'next/navigation'
import { getMember } from '@/lib/auth-server'
import { MembersNav } from '@/components/MembersNav'

export default async function MembersLayout({ children }: { children: React.ReactNode }) {
  const member = await getMember()
  if (!member) redirect('/login')

  return (
    <div>
      <MembersNav />
      {children}
    </div>
  )
}
