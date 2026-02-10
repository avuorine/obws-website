'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { authClient } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'

export function HeaderAuth() {
  const t = useTranslations('common')
  const router = useRouter()
  const pathname = usePathname()
  const { data: session, isPending } = authClient.useSession()

  if (isPending) return null

  if (session) {
    return (
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" className={pathname.startsWith('/members') ? 'bg-accent' : ''} asChild>
          <Link href="/members">{t('members')}</Link>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={async () => {
            await authClient.signOut()
            router.push('/')
            router.refresh()
          }}
        >
          {t('logout')}
        </Button>
      </div>
    )
  }

  return (
    <Button variant="ghost" size="sm" asChild>
      <Link href="/login">{t('login')}</Link>
    </Button>
  )
}
