'use client'

import { useTransition, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import { createMemberSchema, type CreateMemberFormData } from '@/lib/validation'
import { createMember } from '@/app/(frontend)/members/admin/members/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert } from '@/components/ui/alert'
import { DatePicker } from '@/components/ui/date-picker'
import { MunicipalitySelect } from '@/components/MunicipalitySelect'
import { PhoneInput } from '@/components/PhoneInput'

interface CreateMemberFormProps {
  nextMemberNumber: number
}

function getMaxDobDate() {
  const d = new Date()
  d.setFullYear(d.getFullYear() - 18)
  return d
}

export function CreateMemberForm({ nextMemberNumber }: CreateMemberFormProps) {
  const t = useTranslations('admin')
  const maxDob = getMaxDobDate()
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<CreateMemberFormData>({
    resolver: zodResolver(createMemberSchema),
    defaultValues: {
      memberNumber: String(nextMemberNumber),
    },
  })

  function onSubmit(data: CreateMemberFormData) {
    setMessage(null)
    startTransition(async () => {
      const result = await createMember(data)
      if (result.success) {
        setMessage({ type: 'success', text: `${t('memberCreated')} ${t('welcomeEmailSent')}` })
        reset()
      } else {
        const errorKey = result.error as string
        const text = t.has(errorKey) ? t(errorKey as Parameters<typeof t>[0]) : (result.error ?? t('error'))
        setMessage({ type: 'error', text })
      }
    })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="firstName">{t('firstName')}</Label>
          <Input id="firstName" {...register('firstName')} />
          {errors.firstName && <p className="mt-1 text-xs text-red-600">{errors.firstName.message}</p>}
        </div>
        <div>
          <Label htmlFor="lastName">{t('lastName')}</Label>
          <Input id="lastName" {...register('lastName')} />
          {errors.lastName && <p className="mt-1 text-xs text-red-600">{errors.lastName.message}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="email">{t('email')}</Label>
          <Input id="email" type="email" {...register('email')} />
          {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
        </div>
        <div>
          <Label htmlFor="memberNumber">{t('memberNumber')}</Label>
          <Input id="memberNumber" type="number" min={1} {...register('memberNumber')} />
        </div>
      </div>

      <div>
        <Label>{t('phone')}</Label>
        <PhoneInput control={control} name="phone" />
      </div>

      <div>
        <Label>{t('municipality')}</Label>
        <Controller
          control={control}
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

      <div>
        <Label>{t('dateOfBirth')}</Label>
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
      </div>

      {message && (
        <Alert variant={message.type === 'success' ? 'success' : 'destructive'}>
          {message.text}
        </Alert>
      )}

      <Button type="submit" disabled={isPending}>
        {isPending ? t('creating') : t('createMember')}
      </Button>
    </form>
  )
}
