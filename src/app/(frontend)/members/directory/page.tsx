import { getTranslations } from 'next-intl/server'
import { db } from '@/db'
import { user } from '@/db/schema'
import { eq, or, asc } from 'drizzle-orm'

export default async function DirectoryPage() {
  const t = await getTranslations('directory')

  const members = await db
    .select({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      status: user.status,
    })
    .from(user)
    .where(or(eq(user.status, 'active'), eq(user.status, 'honorary')))
    .orderBy(asc(user.lastName), asc(user.firstName))

  const active = members.filter((m) => m.status === 'active')
  const honorary = members.filter((m) => m.status === 'honorary')

  return (
    <div>
      <h1 className="mb-6 font-serif text-3xl font-bold">{t('title')}</h1>

      {members.length === 0 ? (
        <p className="text-whisky-light">{t('noMembers')}</p>
      ) : (
        <>
          {active.length > 0 && (
            <section className="mb-8">
              <h2 className="mb-3 font-serif text-xl font-semibold">{t('activeMembers')}</h2>
              <ul className="space-y-2">
                {active.map((m) => (
                  <li key={m.id} className="rounded-lg border border-border px-4 py-3">
                    {m.firstName} {m.lastName}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {honorary.length > 0 && (
            <section>
              <h2 className="mb-3 font-serif text-xl font-semibold">{t('honoraryMembers')}</h2>
              <ul className="space-y-2">
                {honorary.map((m) => (
                  <li key={m.id} className="rounded-lg border border-border px-4 py-3">
                    {m.firstName} {m.lastName}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  )
}
