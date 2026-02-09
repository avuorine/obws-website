'use client'

import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { membershipSchema, type MembershipFormData } from '@/lib/validation'
import { MunicipalitySelect } from './MunicipalitySelect'
import { PhoneInput } from './PhoneInput'
import { submitMembership } from '@/app/(frontend)/membership/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert } from '@/components/ui/alert'
import { DatePicker } from '@/components/ui/date-picker'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'

function getMaxDobDate() {
  const d = new Date()
  d.setFullYear(d.getFullYear() - 18)
  return d
}

export function MembershipForm() {
  const t = useTranslations('membershipForm')
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')
  const maxDob = getMaxDobDate()

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
      <Alert variant="success" className="text-center">
        {t('success')}
      </Alert>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={t('firstName')} error={errors.firstName && t('requiredField')}>
          <Input
            {...register('firstName')}
            className={cn(errors.firstName && 'border-destructive')}
          />
        </Field>
        <Field label={t('lastName')} error={errors.lastName && t('requiredField')}>
          <Input
            {...register('lastName')}
            className={cn(errors.lastName && 'border-destructive')}
          />
        </Field>
      </div>

      <Field label={t('email')} error={errors.email && t('invalidEmail')}>
        <Input
          {...register('email')}
          type="email"
          className={cn(errors.email && 'border-destructive')}
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
        <Controller
          control={control}
          name="dateOfBirth"
          render={({ field }) => (
            <DatePicker
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              maxDate={maxDob}
            />
          )}
        />
      </Field>

      <div>
        <Controller
          control={control}
          name="privacyConsent"
          defaultValue={false}
          render={({ field }) => (
            <div className="flex items-start gap-2">
              <Checkbox
                id="privacyConsent"
                checked={field.value}
                onCheckedChange={field.onChange}
                className={cn(errors.privacyConsent && 'border-destructive')}
              />
              <label htmlFor="privacyConsent" className="text-sm leading-tight">
                {t.rich('privacyConsent', {
                  link: (chunks) => (
                    <a href="/privacy" target="_blank" className="underline hover:text-foreground">
                      {chunks}
                    </a>
                  ),
                })}
              </label>
            </div>
          )}
        />
        {errors.privacyConsent && (
          <p className="mt-1 text-sm text-destructive">{t('mustAcceptPrivacy')}</p>
        )}
      </div>

      {status === 'error' && (
        <Alert variant="destructive">{t('error')}</Alert>
      )}

      <Button type="submit" disabled={status === 'submitting'} size="lg" className="w-full">
        {status === 'submitting' ? t('submitting') : t('submit')}
      </Button>
    </form>
  )
}

function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string | false
  children: React.ReactNode
}) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
      {error && <p className="mt-1 text-sm text-destructive">{error}</p>}
    </div>
  )
}
