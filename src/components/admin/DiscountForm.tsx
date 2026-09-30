'use client'

import { useTransition, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import { discountSchema, type DiscountFormData } from '@/lib/validation'
import { createDiscount, updateDiscount, deleteDiscount } from '@/app/(frontend)/members/admin/discounts/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert } from '@/components/ui/alert'

interface DiscountFormProps {
  discountId?: string
  defaultValues?: DiscountFormData
}

const LANGS = [
  { suffix: 'Sv', label: 'Svenska' },
  { suffix: 'Fi', label: 'Suomi' },
  { suffix: 'En', label: 'English' },
] as const

export function DiscountForm({ discountId, defaultValues }: DiscountFormProps) {
  const t = useTranslations('admin')
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<DiscountFormData>({
    resolver: zodResolver(discountSchema),
    defaultValues: defaultValues ?? { active: true },
  })

  function onSubmit(data: DiscountFormData) {
    setError('')
    setMessage('')
    startTransition(async () => {
      const result = discountId ? await updateDiscount(discountId, data) : await createDiscount(data)
      if (!result.success) setError(result.error ?? t('error'))
      else if (discountId) setMessage(t('discountSaved'))
      else router.push('/members/admin/discounts')
    })
  }

  function onDelete() {
    if (!discountId || !confirm(t('discountConfirmDelete'))) return
    startTransition(async () => {
      await deleteDiscount(discountId)
      router.push('/members/admin/discounts')
    })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-3">
        {LANGS.map(({ suffix, label }) => (
          <fieldset key={suffix} className="space-y-3 rounded-lg border border-input p-4">
            <legend className="px-1 text-sm font-medium">{label}</legend>
            <div>
              <Label htmlFor={`name${suffix}`}>
                {t('discountName')}
                {suffix === 'Sv' && ' *'}
              </Label>
              <Input id={`name${suffix}`} {...register(`name${suffix}`)} />
              {suffix === 'Sv' && errors.nameSv && <p className="mt-1 text-xs text-red-600">{t('required')}</p>}
            </div>
            <div>
              <Label htmlFor={`offer${suffix}`}>
                {t('discountOffer')}
                {suffix === 'Sv' && ' *'}
              </Label>
              <Input id={`offer${suffix}`} {...register(`offer${suffix}`)} placeholder={t('discountOfferPlaceholder')} />
              {suffix === 'Sv' && errors.offerSv && <p className="mt-1 text-xs text-red-600">{t('required')}</p>}
            </div>
            <div>
              <Label htmlFor={`details${suffix}`}>{t('discountDetails')}</Label>
              <Input id={`details${suffix}`} {...register(`details${suffix}`)} placeholder={t('discountDetailsPlaceholder')} />
            </div>
          </fieldset>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="address">{t('discountAddress')}</Label>
          <Input id="address" {...register('address')} />
        </div>
        <div>
          <Label htmlFor="url">{t('discountUrl')}</Label>
          <Input id="url" type="url" {...register('url')} placeholder="https://" />
          {errors.url && <p className="mt-1 text-xs text-red-600">{errors.url.message}</p>}
        </div>
        <div>
          <Label htmlFor="sortOrder">{t('sortOrder')}</Label>
          <Input id="sortOrder" type="number" {...register('sortOrder')} placeholder="0" />
        </div>
        <div className="flex items-center gap-2 self-end pb-2">
          <input id="active" type="checkbox" className="h-4 w-4" {...register('active')} />
          <Label htmlFor="active">{t('discountActive')}</Label>
        </div>
      </div>

      {error && <Alert variant="destructive">{error}</Alert>}
      {message && <Alert variant="success">{message}</Alert>}

      <div className="flex gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? t('saving') : t('save')}
        </Button>
        {discountId && (
          <Button type="button" variant="destructive" disabled={isPending} onClick={onDelete}>
            {t('delete')}
          </Button>
        )}
      </div>
    </form>
  )
}
