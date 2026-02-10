'use client'

import { useTransition, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import { feePeriodSchema, type FeePeriodFormData } from '@/lib/validation'
import { createFeePeriod } from '@/app/(frontend)/members/admin/fees/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert } from '@/components/ui/alert'
import { DatePicker } from '@/components/ui/date-picker'

export function FeePeriodForm() {
  const t = useTranslations('admin')
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<FeePeriodFormData>({
    resolver: zodResolver(feePeriodSchema),
  })

  function onSubmit(data: FeePeriodFormData) {
    setError('')
    startTransition(async () => {
      const result = await createFeePeriod(data)
      if (result.success) {
        router.push('/members/admin/fees')
      } else {
        setError(result.error ?? t('error'))
      }
    })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <Label htmlFor="name">{t('periodName')}</Label>
        <Input id="name" {...register('name')} placeholder="e.g. 2026 Season" />
        {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
      </div>

      <div>
        <Label htmlFor="amount">{t('amount')} (€)</Label>
        <Input id="amount" {...register('amount')} placeholder="20.00" />
        {errors.amount && <p className="mt-1 text-xs text-red-600">{errors.amount.message}</p>}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <Label>{t('startDate')}</Label>
          <Controller
            control={control}
            name="startDate"
            render={({ field }) => (
              <DatePicker
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
              />
            )}
          />
          {errors.startDate && <p className="mt-1 text-xs text-red-600">{errors.startDate.message}</p>}
        </div>
        <div>
          <Label>{t('endDate')}</Label>
          <Controller
            control={control}
            name="endDate"
            render={({ field }) => (
              <DatePicker
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
              />
            )}
          />
          {errors.endDate && <p className="mt-1 text-xs text-red-600">{errors.endDate.message}</p>}
        </div>
        <div>
          <Label>{t('dueDate')}</Label>
          <Controller
            control={control}
            name="dueDate"
            render={({ field }) => (
              <DatePicker
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
              />
            )}
          />
          {errors.dueDate && <p className="mt-1 text-xs text-red-600">{errors.dueDate.message}</p>}
        </div>
      </div>

      {error && <Alert variant="destructive">{error}</Alert>}

      <Button type="submit" disabled={isPending}>
        {isPending ? t('saving') : t('save')}
      </Button>
    </form>
  )
}
