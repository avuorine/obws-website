'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { authClient } from '@/lib/auth-client'

export function HeaderAuth() {
  const t = useTranslations('common')
  const router = useRouter()
  const { data: session, isPending } = authClient.useSession()

  if (isPending) return null

  if (session) {
    return (
      <div className="flex items-center gap-4">
        <Link href="/members" className="text-sm text-whisky-light hover:text-amber">
          {t('members')}
        </Link>
        <button
          onClick={async () => {
            await authClient.signOut()
            router.push('/')
            router.refresh()
          }}
          className="text-sm text-whisky-light hover:text-amber"
        >
          {t('logout')}
        </button>
      </div>
    )
  }

  return (
    <Link href="/login" className="text-sm text-whisky-light hover:text-amber">
      {t('login')}
    </Link>
  )
}
