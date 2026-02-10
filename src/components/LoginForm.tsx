'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { authClient } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Alert } from '@/components/ui/alert'

export function LoginForm() {
  const t = useTranslations('auth')
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [magicLinkSent, setMagicLinkSent] = useState(false)
  const [magicLinkLoading, setMagicLinkLoading] = useState(false)
  const [passkeyLoading, setPasskeyLoading] = useState(false)
  const [error, setError] = useState('')

  async function handlePasskey() {
    setError('')
    setPasskeyLoading(true)
    try {
      const result = await authClient.signIn.passkey()
      if (result?.error) {
        setError(t('passkeyFailed'))
      } else {
        router.push('/members')
        router.refresh()
      }
    } catch {
      setError(t('passkeyFailed'))
    } finally {
      setPasskeyLoading(false)
    }
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault()
    if (!email) return
    setError('')
    setMagicLinkLoading(true)
    try {
      await authClient.signIn.magicLink({
        email,
        callbackURL: '/members',
      })
      setMagicLinkSent(true)
    } catch {
      setError(t('magicLinkFailed'))
    } finally {
      setMagicLinkLoading(false)
    }
  }

  if (magicLinkSent) {
    return (
      <div className="space-y-4">
        <Alert variant="success">{t('magicLinkSent')}</Alert>
        <Button variant="link" onClick={() => setMagicLinkSent(false)} className="px-0">
          {t('tryAgain')}
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleMagicLink} className="space-y-4">
        <div>
          <Label htmlFor="email">{t('email')}</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email webauthn"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <Button type="submit" disabled={magicLinkLoading} size="lg" className="w-full">
          {magicLinkLoading ? t('sending') : t('sendMagicLink')}
        </Button>
      </form>

      <Separator label={t('or')} />

      <Button
        onClick={handlePasskey}
        disabled={passkeyLoading}
        variant="outline"
        size="lg"
        className="w-full"
      >
        {passkeyLoading ? t('signingIn') : t('signInPasskey')}
      </Button>

      {error && <Alert variant="destructive">{error}</Alert>}
    </div>
  )
}
