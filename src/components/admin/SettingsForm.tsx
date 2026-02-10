'use client'

import { useTransition, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import { settingsSchema, type SettingsFormData } from '@/lib/validation'
import { updateSettings } from '@/app/(frontend)/members/admin/settings/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert } from '@/components/ui/alert'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

interface SettingsFormProps {
  defaultValues: SettingsFormData
}

export function SettingsForm({ defaultValues }: SettingsFormProps) {
  const t = useTranslations('admin')
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    defaultValues,
  })

  function onSubmit(data: SettingsFormData) {
    setError('')
    setMessage('')
    startTransition(async () => {
      const result = await updateSettings(data)
      if (result.success) {
        setMessage(t('settingsSaved'))
      } else {
        setError(result.error ?? t('error'))
      }
      setTimeout(() => setMessage(''), 3000)
    })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('associationName')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="name">{t('associationName')}</Label>
            <Input id="name" {...register('name')} />
            {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
          </div>

          <div>
            <Label htmlFor="address">{t('address')}</Label>
            <Textarea id="address" rows={3} {...register('address')} />
          </div>

          <div>
            <Label htmlFor="businessId">{t('businessId')}</Label>
            <Input id="businessId" {...register('businessId')} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="email">{t('contactEmail')}</Label>
              <Input id="email" type="email" {...register('email')} />
              {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
            </div>
            <div>
              <Label htmlFor="phone">{t('contactPhone')}</Label>
              <Input id="phone" {...register('phone')} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('invoiceSettings')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="iban">{t('iban')}</Label>
              <Input id="iban" {...register('iban')} />
            </div>
            <div>
              <Label htmlFor="bic">{t('bic')}</Label>
              <Input id="bic" {...register('bic')} />
            </div>
          </div>

          <Separator />

          <div>
            <Label htmlFor="nextInvoiceNumber">{t('nextInvoiceNumber')}</Label>
            <Input
              id="nextInvoiceNumber"
              type="number"
              min={1}
              className="w-40"
              {...register('nextInvoiceNumber')}
            />
            {errors.nextInvoiceNumber && (
              <p className="mt-1 text-xs text-red-600">{errors.nextInvoiceNumber.message}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {error && <Alert variant="destructive">{error}</Alert>}
      {message && <Alert>{message}</Alert>}

      <Button type="submit" disabled={isPending}>
        {isPending ? t('saving') : t('save')}
      </Button>
    </form>
  )
}
