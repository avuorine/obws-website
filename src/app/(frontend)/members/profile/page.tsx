import { getTranslations } from 'next-intl/server'
import { getMember } from '@/lib/auth-server'
import { ProfileForm } from '@/components/ProfileForm'

export default async function ProfilePage() {
  const member = await getMember()
  const t = await getTranslations('profile')

  return (
    <div>
      <h1 className="mb-6 font-serif text-3xl font-bold">{t('title')}</h1>

      {member!.memberSince && (
        <p className="mb-6 text-sm text-whisky-light">
          {t('memberSince')}: {new Date(member!.memberSince).toLocaleDateString()}
        </p>
      )}

      <ProfileForm
        initialData={{
          firstName: member!.firstName ?? '',
          lastName: member!.lastName ?? '',
          email: member!.email,
          phone: (member as Record<string, unknown>).phone as string ?? '',
          municipality: (member as Record<string, unknown>).municipality as string ?? '',
        }}
      />
    </div>
  )
}
