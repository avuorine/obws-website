import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { db } from '@/db'
import { user } from '@/db/schema'
import { max } from 'drizzle-orm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CreateMemberForm } from '@/components/admin/CreateMemberForm'
import { ArrowLeft } from 'lucide-react'

export default async function NewMemberPage() {
  const t = await getTranslations('admin')

  const [{ maxNum }] = await db
    .select({ maxNum: max(user.memberNumber) })
    .from(user)
  const nextMemberNumber = (maxNum ?? 0) + 1

  return (
    <div>
      <Link
        href="/members/admin/members"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('back')}
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>{t('createMember')}</CardTitle>
        </CardHeader>
        <CardContent>
          <CreateMemberForm nextMemberNumber={nextMemberNumber} />
        </CardContent>
      </Card>
    </div>
  )
}
