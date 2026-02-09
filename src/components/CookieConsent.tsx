'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

function getCookie(name: string): string | undefined {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : undefined
}

function setCookie(name: string, value: string, days: number) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString()
  document.cookie = `${name}=${encodeURIComponent(value)};expires=${expires};path=/;SameSite=Lax`
}

export function CookieConsent() {
  const t = useTranslations('cookies')
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (getCookie('cookieConsent') === undefined) {
      setVisible(true)
    }
  }, [])

  function accept() {
    setCookie('cookieConsent', 'true', 365 * 10)
    setVisible(false)
    window.dispatchEvent(new Event('cookieConsentChange'))
  }

  function decline() {
    setCookie('cookieConsent', 'false', 365 * 10)
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-4 left-4 z-50 max-w-sm rounded-lg border border-border bg-background p-4 shadow-lg">
      <p className="mb-1 text-sm font-medium">{t('title')}</p>
      <p className="mb-3 text-sm text-muted-foreground">
        {t('description')}{' '}
        <Link href="/privacy" className="underline hover:text-foreground">
          {t('learnMore')}
        </Link>
      </p>
      <div className="flex gap-2">
        <Button size="sm" onClick={accept}>
          {t('accept')}
        </Button>
        <Button size="sm" variant="outline" onClick={decline}>
          {t('decline')}
        </Button>
      </div>
    </div>
  )
}
