'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'

const Analytics = dynamic(
  () => import('@vercel/analytics/next').then((mod) => mod.Analytics),
  { ssr: false },
)

export function AnalyticsWrapper() {
  const [consented, setConsented] = useState(false)

  useEffect(() => {
    function check() {
      const match = document.cookie.match(/(?:^|; )cookieConsent=([^;]*)/)
      setConsented(match?.[1] === 'true')
    }
    check()
    window.addEventListener('cookieConsentChange', check)
    return () => window.removeEventListener('cookieConsentChange', check)
  }, [])

  if (!consented) return null
  return <Analytics />
}
