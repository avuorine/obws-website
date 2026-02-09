import { redirect } from 'next/navigation'
import { getTranslations, getLocale } from 'next-intl/server'
import { getMember } from '@/lib/auth-server'
import { formatDate } from '@/lib/format-date'
import { ProfileForm } from '@/components/ProfileForm'

export default async function ProfilePage() {
  const member = await getMember()
  if (!member) redirect('/login')

  const t = await getTranslations('profile')
  const locale = await getLocale()

  return (
    <div>
      <h1 className="mb-6 font-serif text-3xl font-bold">{t('title')}</h1>

      <div className="mb-6 flex flex-wrap gap-4 text-sm text-whisky-light">
        {member.memberNumber != null && (
          <span>{t('memberNumber')}: {member.memberNumber}</span>
        )}
        {member.memberSince && (
          <span>{t('memberSince')}: {formatDate(member.memberSince, locale)}</span>
        )}
      </div>

      <ProfileForm
        initialData={{
          firstName: member.firstName ?? '',
          lastName: member.lastName ?? '',
          email: member.email,
          phone: (member as Record<string, unknown>).phone as string ?? '',
          municipality: (member as Record<string, unknown>).municipality as string ?? '',
          marketingEmails: (member as Record<string, unknown>).marketingEmails as boolean ?? true,
        }}
      />
    </div>
  )
}
