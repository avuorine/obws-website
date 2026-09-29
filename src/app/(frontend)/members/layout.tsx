import { redirect } from 'next/navigation'
import { getMember } from '@/lib/auth-server'
import { MembersNav } from '@/components/MembersNav'
import { OverdueBanner } from '@/components/OverdueBanner'

export default async function MembersLayout({ children }: { children: React.ReactNode }) {
  const member = await getMember()
  if (!member) redirect('/login')

  const isAdmin = member.role === 'admin'

  return (
    <div className="flex flex-col gap-6">
      <OverdueBanner userId={member.id} />
      <div className="flex flex-col gap-6 md:flex-row">
        <MembersNav isAdmin={isAdmin} />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  )
}
