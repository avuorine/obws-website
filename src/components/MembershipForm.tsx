'use client'

import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { membershipSchema, type MembershipFormData } from '@/lib/validation'
import { MunicipalitySelect } from './MunicipalitySelect'
import { PhoneInput } from './PhoneInput'
import { submitMembership } from '@/app/(frontend)/membership/actions'

export function MembershipForm() {
  const t = useTranslations('membershipForm')
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<MembershipFormData>({
    resolver: zodResolver(membershipSchema),
  })

  async function onSubmit(data: MembershipFormData) {
    setStatus('submitting')
    const result = await submitMembership(data)
    setStatus(result.success ? 'success' : 'error')
  }

  if (status === 'success') {
    return (
      <div className="rounded-lg border border-green-300 bg-green-50 p-6 text-center">
        <p className="text-green-800">{t('success')}</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={t('firstName')} error={errors.firstName && t('requiredField')}>
          <input
            {...register('firstName')}
            type="text"
            className={inputClass(!!errors.firstName)}
          />
        </Field>
        <Field label={t('lastName')} error={errors.lastName && t('requiredField')}>
          <input
            {...register('lastName')}
            type="text"
            className={inputClass(!!errors.lastName)}
          />
        </Field>
      </div>

      <Field label={t('email')} error={errors.email && t('invalidEmail')}>
        <input
          {...register('email')}
          type="email"
          className={inputClass(!!errors.email)}
        />
      </Field>

      <Field label={t('phone')} error={errors.phone && t('invalidPhone')}>
        <PhoneInput control={control} name="phone" error={!!errors.phone} />
      </Field>

      <Field label={t('municipality')} error={errors.municipality && t('selectMunicipality')}>
        <Controller
          control={control}
          name="municipality"
          render={({ field }) => (
            <MunicipalitySelect
              name={field.name}
              value={field.value ?? ''}
              onChange={field.onChange}
              onBlur={field.onBlur}
              error={errors.municipality?.message}
            />
          )}
        />
      </Field>

      <Field label={t('dateOfBirth')} error={errors.dateOfBirth && t('mustBe18')}>
        <input
          {...register('dateOfBirth')}
          type="date"
          className={inputClass(!!errors.dateOfBirth)}
        />
      </Field>

      {status === 'error' && (
        <p className="text-sm text-red-600">{t('error')}</p>
      )}

      <button
        type="submit"
        disabled={status === 'submitting'}
        className="w-full rounded-lg bg-amber px-6 py-3 font-medium text-white transition-colors hover:bg-amber/90 disabled:opacity-50"
      >
        {status === 'submitting' ? t('submitting') : t('submit')}
      </button>
    </form>
  )
}

function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-whisky-light">{label}</label>
      {children}
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  )
}

function inputClass(hasError: boolean) {
  return `w-full rounded-lg border px-4 py-2.5 text-whisky outline-none transition-colors placeholder:text-whisky-light/50 focus:border-amber focus:ring-1 focus:ring-amber ${
    hasError ? 'border-red-400' : 'border-border'
  }`
}
