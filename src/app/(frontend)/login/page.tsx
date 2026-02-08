import { getTranslations } from 'next-intl/server'
import { redirect } from 'next/navigation'
import { getMember } from '@/lib/auth-server'
import { LoginForm } from '@/components/LoginForm'

export default async function LoginPage() {
  const member = await getMember()
  if (member) redirect('/members')

  const t = await getTranslations('auth')

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-6 font-serif text-3xl font-bold">{t('loginTitle')}</h1>
      <LoginForm />
    </div>
  )
}
