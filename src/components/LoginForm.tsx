'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { authClient } from '@/lib/auth-client'

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
        <p className="text-whisky-light">{t('magicLinkSent')}</p>
        <button
          onClick={() => setMagicLinkSent(false)}
          className="text-sm text-amber hover:underline"
        >
          {t('tryAgain')}
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <button
        onClick={handlePasskey}
        disabled={passkeyLoading}
        className="w-full rounded-lg bg-amber px-4 py-3 font-medium text-white transition-colors hover:bg-amber/90 disabled:opacity-50"
      >
        {passkeyLoading ? t('signingIn') : t('signInPasskey')}
      </button>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-white px-2 text-whisky-light">{t('or')}</span>
        </div>
      </div>

      <form onSubmit={handleMagicLink} className="space-y-4">
        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium">
            {t('email')}
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-lg border border-border bg-white px-4 py-2 focus:border-amber focus:outline-none focus:ring-1 focus:ring-amber"
          />
        </div>

        <button
          type="submit"
          disabled={magicLinkLoading}
          className="w-full rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors hover:border-amber hover:text-amber disabled:opacity-50"
        >
          {magicLinkLoading ? t('sending') : t('sendMagicLink')}
        </button>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
