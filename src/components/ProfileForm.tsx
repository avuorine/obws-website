'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { profileUpdateSchema, type ProfileUpdateFormData } from '@/lib/validation'
import { authClient } from '@/lib/auth-client'
import { updateProfile } from './actions'

interface ProfileFormProps {
  initialData: {
    firstName: string
    lastName: string
    email: string
    phone: string
    municipality: string
  }
}

export function ProfileForm({ initialData }: ProfileFormProps) {
  const t = useTranslations('profile')
  const tAuth = useTranslations('auth')
  const router = useRouter()
  const [profileMessage, setProfileMessage] = useState('')
  const [passkeyMessage, setPasskeyMessage] = useState('')
  const [passkeyError, setPasskeyError] = useState('')

  const profileForm = useForm<ProfileUpdateFormData>({
    resolver: zodResolver(profileUpdateSchema),
    defaultValues: {
      firstName: initialData.firstName,
      lastName: initialData.lastName,
      phone: initialData.phone,
      municipality: initialData.municipality,
    },
  })

  async function onProfileSubmit(data: ProfileUpdateFormData) {
    setProfileMessage('')
    const result = await updateProfile(data)
    if (result.success) {
      setProfileMessage(t('saved'))
      router.refresh()
    }
  }

  async function handleRegisterPasskey() {
    setPasskeyMessage('')
    setPasskeyError('')
    try {
      const result = await authClient.passkey.addPasskey()
      if (result?.error) {
        setPasskeyError(tAuth('passkeyFailed'))
      } else {
        setPasskeyMessage(t('passkeyAdded'))
      }
    } catch {
      setPasskeyError(tAuth('passkeyFailed'))
    }
  }

  return (
    <div className="space-y-10">
      <section>
        <h2 className="mb-4 font-serif text-xl font-semibold">{t('personalInfo')}</h2>
        <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">{t('email')}</label>
            <input
              type="email"
              value={initialData.email}
              disabled
              className="w-full rounded-lg border border-border bg-gray-50 px-4 py-2 text-whisky-light"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium">{t('firstName')}</label>
              <input
                {...profileForm.register('firstName')}
                className="w-full rounded-lg border border-border bg-white px-4 py-2 focus:border-amber focus:outline-none focus:ring-1 focus:ring-amber"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">{t('lastName')}</label>
              <input
                {...profileForm.register('lastName')}
                className="w-full rounded-lg border border-border bg-white px-4 py-2 focus:border-amber focus:outline-none focus:ring-1 focus:ring-amber"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">{t('phone')}</label>
            <input
              {...profileForm.register('phone')}
              className="w-full rounded-lg border border-border bg-white px-4 py-2 focus:border-amber focus:outline-none focus:ring-1 focus:ring-amber"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">{t('municipality')}</label>
            <input
              {...profileForm.register('municipality')}
              className="w-full rounded-lg border border-border bg-white px-4 py-2 focus:border-amber focus:outline-none focus:ring-1 focus:ring-amber"
            />
          </div>

          <button
            type="submit"
            disabled={profileForm.formState.isSubmitting}
            className="rounded-lg bg-amber px-6 py-2 font-medium text-white transition-colors hover:bg-amber/90 disabled:opacity-50"
          >
            {profileForm.formState.isSubmitting ? t('saving') : t('save')}
          </button>

          {profileMessage && (
            <p className="text-sm text-green-600">{profileMessage}</p>
          )}
        </form>
      </section>

      <section>
        <h2 className="mb-4 font-serif text-xl font-semibold">{t('passkeys')}</h2>
        <p className="mb-4 text-sm text-whisky-light">{t('passkeyDescription')}</p>
        <button
          onClick={handleRegisterPasskey}
          className="rounded-lg border border-amber px-6 py-2 text-sm font-medium text-amber transition-colors hover:bg-amber/10"
        >
          {t('addPasskey')}
        </button>

        {passkeyError && <p className="mt-2 text-sm text-red-600">{passkeyError}</p>}
        {passkeyMessage && <p className="mt-2 text-sm text-green-600">{passkeyMessage}</p>}
      </section>
    </div>
  )
}
