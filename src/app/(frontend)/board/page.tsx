import { getTranslations } from 'next-intl/server'

const boardMembers = [
  { name: 'Andreas Vuorinen', role: 'chairman' },
  { name: 'Benjamin Burman', role: 'secretary' },
  { name: 'Conny Södergård', role: 'treasurer' },
] as const

export default async function BoardPage() {
  const t = await getTranslations('board')

  return (
    <div>
      <h1 className="mb-8 font-serif text-3xl font-bold">{t('title')}</h1>

      <section className="mb-10">
        <h2 className="mb-4 font-serif text-xl font-semibold text-whisky">
          {t('members')}
        </h2>
        <div className="space-y-4">
          {boardMembers.map((member) => (
            <div
              key={member.name}
              className="rounded-lg border border-border bg-parchment/30 p-4"
            >
              <p className="font-medium text-whisky">{member.name}</p>
              <p className="text-sm text-whisky-light">{t(member.role)}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-4 font-serif text-xl font-semibold text-whisky">
          {t('contact')}
        </h2>
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-parchment/30 p-4">
            <p className="font-medium text-whisky">{t('generalEnquiries')}</p>
            <a
              href="mailto:chairman@obws.fi"
              className="text-amber hover:underline"
            >
              chairman@obws.fi
            </a>
          </div>
          <div className="rounded-lg border border-border bg-parchment/30 p-4">
            <p className="font-medium text-whisky">{t('membershipMatters')}</p>
            <a
              href="mailto:members@obws.fi"
              className="text-amber hover:underline"
            >
              members@obws.fi
            </a>
          </div>
        </div>
      </section>
    </div>
  )
}
