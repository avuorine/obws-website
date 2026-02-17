'use client'

import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { Fingerprint, KeyRound, Pencil, Trash2 } from 'lucide-react'
import { profileUpdateSchema, type ProfileUpdateFormData } from '@/lib/validation'
import { authClient } from '@/lib/auth-client'
import { formatDate } from '@/lib/format-date'
import { updateProfile, updateEmailPreferences, exportMyData, deleteMyAccount } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert } from '@/components/ui/alert'
import { MunicipalitySelect } from '@/components/MunicipalitySelect'
import { PhoneInput } from '@/components/PhoneInput'
import { Switch } from '@/components/ui/switch'

interface ProfileFormProps {
  initialData: {
    firstName: string
    lastName: string
    email: string
    phone: string
    municipality: string
    marketingEmails: boolean
  }
}

export function ProfileForm({ initialData }: ProfileFormProps) {
  const t = useTranslations('profile')
  const tAuth = useTranslations('auth')
  const locale = useLocale()
  const router = useRouter()
  const [profileMessage, setProfileMessage] = useState('')
  const [passkeyMessage, setPasskeyMessage] = useState('')
  const [passkeyError, setPasskeyError] = useState('')
  const [marketingEmails, setMarketingEmails] = useState(initialData.marketingEmails)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const { data: passkeys, isPending: passkeysLoading } = authClient.useListPasskeys()

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
    const name = window.prompt(t('passkeyNamePlaceholder'))
    if (name === null) return // cancelled
    try {
      const result = await authClient.passkey.addPasskey({ name: name || undefined })
      if (result?.error) {
        setPasskeyError(tAuth('passkeyFailed'))
      } else {
        setPasskeyMessage(t('passkeyAdded'))
      }
    } catch {
      setPasskeyError(tAuth('passkeyFailed'))
    }
  }

  async function handleDeletePasskey(id: string) {
    if (!window.confirm(t('passkeyDeleteConfirm'))) return
    setPasskeyMessage('')
    setPasskeyError('')
    try {
      await authClient.$fetch('/passkey/delete-passkey', {
        method: 'POST',
        body: { id },
      })
      setPasskeyMessage(t('passkeyDeleted'))
    } catch {
      setPasskeyError(tAuth('passkeyFailed'))
    }
  }

  async function handleRenamePasskey(id: string) {
    setPasskeyMessage('')
    setPasskeyError('')
    try {
      await authClient.$fetch('/passkey/update-passkey', {
        method: 'POST',
        body: { id, name: renameValue },
      })
      setRenamingId(null)
      setRenameValue('')
      setPasskeyMessage(t('passkeyRenamed'))
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
            <Label>{t('email')}</Label>
            <Input type="email" value={initialData.email} disabled />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>{t('firstName')}</Label>
              <Input {...profileForm.register('firstName')} />
            </div>
            <div>
              <Label>{t('lastName')}</Label>
              <Input {...profileForm.register('lastName')} />
            </div>
          </div>

          <div>
            <Label>{t('phone')}</Label>
            <PhoneInput control={profileForm.control} name="phone" />
          </div>

          <div>
            <Label>{t('municipality')}</Label>
            <Controller
              control={profileForm.control}
              name="municipality"
              render={({ field }) => (
                <MunicipalitySelect
                  name={field.name}
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                />
              )}
            />
          </div>

          <Button type="submit" disabled={profileForm.formState.isSubmitting}>
            {profileForm.formState.isSubmitting ? t('saving') : t('save')}
          </Button>

          {profileMessage && <Alert variant="success">{profileMessage}</Alert>}
        </form>
      </section>

      <section>
        <h2 className="mb-4 font-serif text-xl font-semibold">{t('passkeys')}</h2>
        <p className="mb-4 text-sm text-muted-foreground">{t('passkeyDescription')}</p>

        {passkeysLoading ? (
          <p className="text-sm text-muted-foreground">...</p>
        ) : passkeys && passkeys.length > 0 ? (
          <div className="mb-4 space-y-3">
            {passkeys.map((pk) => (
              <div
                key={pk.id}
                className="flex items-center gap-3 rounded-lg border border-input p-3"
              >
                {pk.deviceType === 'singleDevice' ? (
                  <Fingerprint className="h-5 w-5 shrink-0 text-muted-foreground" />
                ) : (
                  <KeyRound className="h-5 w-5 shrink-0 text-muted-foreground" />
                )}
                <div className="min-w-0 flex-1">
                  {renamingId === pk.id ? (
                    <form
                      className="flex items-center gap-2"
                      onSubmit={(e) => {
                        e.preventDefault()
                        handleRenamePasskey(pk.id)
                      }}
                    >
                      <Input
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        className="h-8"
                        autoFocus
                      />
                      <Button type="submit" size="sm" variant="outline">
                        {t('save')}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setRenamingId(null)}
                      >
                        &times;
                      </Button>
                    </form>
                  ) : (
                    <>
                      <p className="truncate text-sm font-medium">
                        {pk.name || t('passkeyUnnamed')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {pk.deviceType === 'singleDevice'
                          ? t('passkeyDevicePlatform')
                          : t('passkeyDeviceCrossPlatform')}
                        {' · '}
                        {t('passkeyCreated')}{' '}
                        {formatDate(pk.createdAt, locale)}
                      </p>
                    </>
                  )}
                </div>
                {renamingId !== pk.id && (
                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      title={t('passkeyRename')}
                      onClick={() => {
                        setRenamingId(pk.id)
                        setRenameValue(pk.name || '')
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      title={t('passkeyDelete')}
                      onClick={() => handleDeletePasskey(pk.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="mb-4 text-sm text-muted-foreground">{t('passkeyNoPasskeys')}</p>
        )}

        <Button variant="outline" onClick={handleRegisterPasskey}>
          {t('addPasskey')}
        </Button>

        {passkeyError && <Alert variant="destructive" className="mt-2">{passkeyError}</Alert>}
        {passkeyMessage && <Alert variant="success" className="mt-2">{passkeyMessage}</Alert>}
      </section>

      <section>
        <h2 className="mb-4 font-serif text-xl font-semibold">{t('dataPrivacy')}</h2>

        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{t('marketingEmails')}</p>
              <p className="text-sm text-muted-foreground">{t('marketingEmailsDescription')}</p>
            </div>
            <Switch
              checked={marketingEmails}
              onCheckedChange={async (checked) => {
                setMarketingEmails(checked)
                await updateEmailPreferences(checked)
              }}
            />
          </div>

          <div>
            <p className="text-sm font-medium">{t('exportData')}</p>
            <p className="mb-2 text-sm text-muted-foreground">{t('exportDataDescription')}</p>
            <Button
              variant="outline"
              onClick={async () => {
                const result = await exportMyData()
                if (result.success && result.data) {
                  const blob = new Blob([result.data], { type: 'application/json' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = 'my-data.json'
                  a.click()
                  URL.revokeObjectURL(url)
                }
              }}
            >
              {t('exportData')}
            </Button>
          </div>

          <div>
            <p className="text-sm font-medium">{t('deleteAccount')}</p>
            <p className="mb-2 text-sm text-muted-foreground">{t('deleteAccountDescription')}</p>
            <Button
              variant="destructive"
              onClick={async () => {
                if (!window.confirm(t('confirmDelete'))) return
                await deleteMyAccount()
              }}
            >
              {t('deleteAccount')}
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
