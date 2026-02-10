import Image from 'next/image'
import { getTranslations } from 'next-intl/server'
import { Card, CardContent } from '@/components/ui/card'

const otherBoardMembers = [
  { name: 'Benjamin Burman', role: 'secretary' },
  { name: 'Conny Södergård', role: 'treasurer' },
] as const

export default async function BoardPage() {
  const t = await getTranslations('board')

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-8 font-serif text-3xl font-bold">{t('title')}</h1>

      <section className="mb-10">
        <h2 className="mb-4 font-serif text-xl font-semibold">
          {t('members')}
        </h2>
        <div className="space-y-4">
          <Card className="overflow-hidden">
            <div className="flex">
              <div className="relative w-1/3 shrink-0 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.1)]">
                <Image
                  src="/av.png"
                  alt="Andreas Vuorinen"
                  fill
                  className="object-cover"
                />
              </div>
              <CardContent className="p-6">
                <p className="font-medium">Andreas Vuorinen</p>
                <p className="text-sm text-muted-foreground">{t('chairman')}</p>
                <p className="mt-2 text-sm">{t('chairmanBio')}</p>
              </CardContent>
            </div>
          </Card>
          {otherBoardMembers.map((member) => (
            <Card key={member.name}>
              <CardContent className="p-4">
                <p className="font-medium">{member.name}</p>
                <p className="text-sm text-muted-foreground">{t(member.role)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-4 font-serif text-xl font-semibold">
          {t('contact')}
        </h2>
        <div className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <p className="font-medium">{t('generalEnquiries')}</p>
              <a
                href="mailto:chairman@obws.fi"
                className="text-primary hover:underline"
              >
                chairman@obws.fi
              </a>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="font-medium">{t('membershipMatters')}</p>
              <a
                href="mailto:members@obws.fi"
                className="text-primary hover:underline"
              >
                members@obws.fi
              </a>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  )
}
