'use client'

import { useTransition, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import { CheckIcon, ChevronsUpDownIcon } from 'lucide-react'
import { eventSchema, type EventFormData } from '@/lib/validation'
import { createEvent, updateEvent } from '@/app/(frontend)/members/admin/events/actions'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Alert } from '@/components/ui/alert'
import { Checkbox } from '@/components/ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command'

interface Category {
  id: string
  slug: string
  nameLocales: { sv?: string; fi?: string; en?: string }
}

interface EventFormProps {
  eventId?: string
  defaultValues?: EventFormData
  categories: Category[]
}

const langs = ['sv', 'fi', 'en'] as const
type Lang = (typeof langs)[number]

export function EventForm({ eventId, defaultValues, categories }: EventFormProps) {
  const t = useTranslations('admin')
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [lang, setLang] = useState<Lang>('sv')

  const {
    register,
    handleSubmit,
    watch,
    control,
    formState: { errors },
  } = useForm<EventFormData>({
    resolver: zodResolver(eventSchema),
    defaultValues: defaultValues ?? { allocationMethod: 'first_come', cancellationAllowed: 'on' },
  })

  const allocationMethod = watch('allocationMethod')
  const cancellationAllowed = watch('cancellationAllowed')
  const guestAllowed = watch('guestAllowed')

  const langSuffix = lang.charAt(0).toUpperCase() + lang.slice(1) as 'Sv' | 'Fi' | 'En'

  function onSubmit(data: EventFormData) {
    setError('')
    setMessage('')
    startTransition(async () => {
      const result = eventId
        ? await updateEvent(eventId, data)
        : await createEvent(data)
      if (result.success) {
        if (eventId) {
          setMessage(t('eventUpdated'))
        } else {
          router.push(`/members/admin/events/${'id' in result ? result.id : ''}`)
        }
      } else {
        setError(result.error ?? t('error'))
      }
    })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Localized fields */}
      <div className="space-y-4">
        <div className="flex justify-end">
          <div className="inline-flex overflow-hidden rounded-md border border-input text-xs">
            {langs.map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLang(l)}
                className={cn(
                  'px-2.5 py-1 font-medium uppercase transition-colors',
                  lang === l
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background text-muted-foreground hover:bg-muted',
                )}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label htmlFor={`title${langSuffix}`}>
            {t('eventTitle')} {lang === 'sv' && '*'}
          </Label>
          {langs.map((l) => {
            const suffix = l.charAt(0).toUpperCase() + l.slice(1) as 'Sv' | 'Fi' | 'En'
            return (
              <Input
                key={l}
                id={`title${suffix}`}
                {...register(`title${suffix}`)}
                className={l !== lang ? 'hidden' : ''}
              />
            )
          })}
          {errors.titleSv && lang === 'sv' && <p className="mt-1 text-xs text-red-600">{errors.titleSv.message}</p>}
        </div>

        <div>
          <Label htmlFor={`summary${langSuffix}`}>{t('summary')}</Label>
          {langs.map((l) => {
            const suffix = l.charAt(0).toUpperCase() + l.slice(1) as 'Sv' | 'Fi' | 'En'
            return (
              <Textarea
                key={l}
                id={`summary${suffix}`}
                rows={2}
                {...register(`summary${suffix}`)}
                className={l !== lang ? 'hidden' : ''}
              />
            )
          })}
        </div>

        <div>
          <Label htmlFor={`description${langSuffix}`}>{t('description')}</Label>
          {langs.map((l) => {
            const suffix = l.charAt(0).toUpperCase() + l.slice(1) as 'Sv' | 'Fi' | 'En'
            return (
              <Textarea
                key={l}
                id={`description${suffix}`}
                rows={4}
                {...register(`description${suffix}`)}
                className={l !== lang ? 'hidden' : ''}
              />
            )
          })}
        </div>

        <div>
          <Label htmlFor={`location${langSuffix}`}>{t('location')}</Label>
          {langs.map((l) => {
            const suffix = l.charAt(0).toUpperCase() + l.slice(1) as 'Sv' | 'Fi' | 'En'
            return (
              <Input
                key={l}
                id={`location${suffix}`}
                {...register(`location${suffix}`)}
                className={l !== lang ? 'hidden' : ''}
              />
            )
          })}
        </div>
      </div>

      {/* Date/time */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="date">{t('eventDate')} *</Label>
          <Input id="date" type="datetime-local" {...register('date')} />
          {errors.date && <p className="mt-1 text-xs text-red-600">{errors.date.message}</p>}
        </div>
        <div>
          <Label htmlFor="endDate">{t('endDate')}</Label>
          <Input id="endDate" type="datetime-local" {...register('endDate')} />
        </div>
      </div>

      {/* Category */}
      <div>
        <Label>{t('category')}</Label>
        <Controller
          control={control}
          name="categoryId"
          render={({ field }) => {
            const selected = categories.find((c) => c.id === field.value)
            return (
              <ComboboxSelect
                value={field.value ?? ''}
                onChange={field.onChange}
                placeholder={t('selectCategory')}
                emptyLabel="—"
                options={[
                  { value: '', label: t('noCategory') },
                  ...categories.map((cat) => ({
                    value: cat.id,
                    label: cat.nameLocales.sv ?? cat.slug,
                  })),
                ]}
                displayValue={selected ? (selected.nameLocales.sv ?? selected.slug) : t('noCategory')}
              />
            )
          }}
        />
      </div>

      {/* Capacity & price */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="capacity">{t('capacity')}</Label>
          <Input id="capacity" type="number" min={0} {...register('capacity')} />
        </div>
        <div>
          <Label htmlFor="price">{t('price')}</Label>
          <div className="relative">
            <Input id="price" type="number" min={0} step="0.01" className="pr-14" {...register('price')} />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">EUR</span>
          </div>
        </div>
      </div>

      {/* Registration */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>{t('allocationMethod')}</Label>
          <Controller
            control={control}
            name="allocationMethod"
            render={({ field }) => {
              const allocationOptions = [
                { value: 'first_come' as const, label: t('firstCome') },
                { value: 'lottery' as const, label: t('lottery') },
              ]
              const selectedOption = allocationOptions.find((o) => o.value === field.value)
              return (
                <ComboboxSelect
                  value={field.value}
                  onChange={field.onChange}
                  placeholder={t('allocationMethod')}
                  emptyLabel="—"
                  options={allocationOptions}
                  displayValue={selectedOption?.label ?? t('firstCome')}
                />
              )
            }}
          />
        </div>
        <div>
          <Label htmlFor="registrationOpensAt">{t('registrationOpensAt')}</Label>
          <Input id="registrationOpensAt" type="datetime-local" {...register('registrationOpensAt')} />
        </div>
        <div>
          <Label htmlFor="registrationDeadline">{t('registrationDeadline')}</Label>
          <Input id="registrationDeadline" type="datetime-local" {...register('registrationDeadline')} />
        </div>
      </div>

      {allocationMethod === 'lottery' && (
        <div className="sm:w-1/2">
          <Label htmlFor="lotteryDate">{t('lotteryDate')}</Label>
          <Input id="lotteryDate" type="datetime-local" {...register('lotteryDate')} />
        </div>
      )}

      {/* Cancellation */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Controller
            control={control}
            name="cancellationAllowed"
            render={({ field }) => (
              <Checkbox
                id="cancellationAllowed"
                checked={field.value === 'on'}
                onCheckedChange={(checked) => field.onChange(checked ? 'on' : '')}
              />
            )}
          />
          <Label htmlFor="cancellationAllowed" className="translate-y-[2px]">{t('cancellationAllowed')}</Label>
        </div>
        {cancellationAllowed === 'on' && (
          <div className="sm:w-1/2">
            <Label htmlFor="cancellationDeadline">{t('cancellationDeadline')}</Label>
            <Input id="cancellationDeadline" type="datetime-local" {...register('cancellationDeadline')} />
          </div>
        )}
      </div>

      {/* Guest settings */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Controller
            control={control}
            name="guestAllowed"
            render={({ field }) => (
              <Checkbox
                id="guestAllowed"
                checked={field.value === 'on'}
                onCheckedChange={(checked) => field.onChange(checked ? 'on' : '')}
              />
            )}
          />
          <Label htmlFor="guestAllowed" className="translate-y-[2px]">{t('guestAllowed')}</Label>
        </div>
        {guestAllowed === 'on' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="maxGuestsPerMember">{t('maxGuestsPerMember')}</Label>
              <Input id="maxGuestsPerMember" type="number" min={1} {...register('maxGuestsPerMember')} />
            </div>
            <div>
              <Label htmlFor="guestRegistrationOpensAt">{t('guestRegistrationOpensAt')}</Label>
              <Input id="guestRegistrationOpensAt" type="datetime-local" {...register('guestRegistrationOpensAt')} />
            </div>
          </div>
        )}
      </div>

      {error && <Alert variant="destructive">{error}</Alert>}
      {message && <Alert variant="success">{message}</Alert>}

      <Button type="submit" disabled={isPending}>
        {isPending ? t('saving') : t('save')}
      </Button>
    </form>
  )
}

function ComboboxSelect({
  value,
  onChange,
  placeholder,
  emptyLabel,
  options,
  displayValue,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  emptyLabel: string
  options: { value: string; label: string }[]
  displayValue: string
}) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          {displayValue}
          <ChevronsUpDownIcon className="ml-auto h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandList>
            <CommandEmpty>{emptyLabel}</CommandEmpty>
            <CommandGroup>
              {options.map((opt) => (
                <CommandItem
                  key={opt.value}
                  value={opt.label}
                  onSelect={() => {
                    onChange(opt.value)
                    setOpen(false)
                  }}
                >
                  <CheckIcon
                    className={cn(
                      'mr-2 h-4 w-4',
                      value === opt.value ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  {opt.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
