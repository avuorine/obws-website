import { eq, or, and } from 'drizzle-orm'
import { count } from 'drizzle-orm'
import { getTranslations } from 'next-intl/server'
import { requireAdmin } from '@/lib/admin-guard'
import { db } from '@/db'
import { user } from '@/db/schema'
import { MassEmailForm } from '@/components/admin/MassEmailForm'

export default async function MassEmailPage() {
  await requireAdmin()
  const t = await getTranslations('admin')

  const subscribed = eq(user.marketingEmails, true)
  const [activeResult, honoraryResult, totalResult] = await Promise.all([
    db.select({ count: count() }).from(user).where(and(eq(user.status, 'active'), subscribed)),
    db.select({ count: count() }).from(user).where(and(eq(user.status, 'honorary'), subscribed)),
    db.select({ count: count() }).from(user).where(and(or(eq(user.status, 'active'), eq(user.status, 'honorary')), subscribed)),
  ])

  const counts = {
    active: activeResult[0].count,
    honorary: honoraryResult[0].count,
    total: totalResult[0].count,
  }

  return (
    <div>
      <h1 className="mb-2 font-serif text-3xl font-bold">{t('massEmail')}</h1>
      <p className="mb-6 text-muted-foreground">{t('massEmailDescription')}</p>
      <MassEmailForm counts={counts} />
    </div>
  )
}
