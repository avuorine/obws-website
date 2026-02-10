'use client'

import { useTransition, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import { categorySchema, type CategoryFormData } from '@/lib/validation'
import { createCategory, updateCategory, deleteCategory } from '@/app/(frontend)/members/admin/categories/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert } from '@/components/ui/alert'

interface CategoryFormProps {
  categoryId?: string
  defaultValues?: CategoryFormData
}

export function CategoryForm({ categoryId, defaultValues }: CategoryFormProps) {
  const t = useTranslations('admin')
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues,
  })

  function onSubmit(data: CategoryFormData) {
    setError('')
    setMessage('')
    startTransition(async () => {
      const result = categoryId
        ? await updateCategory(categoryId, data)
        : await createCategory(data)
      if (result.success) {
        if (categoryId) {
          setMessage(t('categoryUpdated'))
        } else {
          router.push('/members/admin/categories')
        }
      } else {
        setError(result.error ?? t('error'))
      }
    })
  }

  function onDelete() {
    if (!categoryId) return
    setError('')
    setMessage('')
    startTransition(async () => {
      const result = await deleteCategory(categoryId)
      if (result.success) {
        router.push('/members/admin/categories')
      } else {
        setError(result.error === 'categoryInUse' ? t('categoryInUse') : (result.error ?? t('error')))
      }
    })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <Label htmlFor="slug">{t('slug')}</Label>
        <Input id="slug" {...register('slug')} placeholder="e.g. tasting" />
        {errors.slug && <p className="mt-1 text-xs text-red-600">{errors.slug.message}</p>}
      </div>

      <div>
        <Label htmlFor="nameSv">{t('nameSv')}</Label>
        <Input id="nameSv" {...register('nameSv')} />
        {errors.nameSv && <p className="mt-1 text-xs text-red-600">{errors.nameSv.message}</p>}
      </div>

      <div>
        <Label htmlFor="nameFi">{t('nameFi')}</Label>
        <Input id="nameFi" {...register('nameFi')} />
      </div>

      <div>
        <Label htmlFor="nameEn">{t('nameEn')}</Label>
        <Input id="nameEn" {...register('nameEn')} />
      </div>

      <div>
        <Label htmlFor="sortOrder">{t('sortOrder')}</Label>
        <Input id="sortOrder" type="number" {...register('sortOrder')} placeholder="0" />
      </div>

      {error && <Alert variant="destructive">{error}</Alert>}
      {message && <Alert>{message}</Alert>}

      <div className="flex gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? t('saving') : t('save')}
        </Button>
        {categoryId && (
          <Button type="button" variant="destructive" disabled={isPending} onClick={onDelete}>
            {t('delete')}
          </Button>
        )}
      </div>
    </form>
  )
}
