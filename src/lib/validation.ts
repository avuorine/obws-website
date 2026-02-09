import { z } from 'zod'
import { isValidPhoneNumber } from 'libphonenumber-js'

export const membershipSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().refine((val) => isValidPhoneNumber(val || ''), {
    message: 'invalidPhone',
  }),
  municipality: z.string().min(1),
  dateOfBirth: z.string().refine(
    (val) => {
      const date = new Date(val)
      if (isNaN(date.getTime())) return false
      const today = new Date()
      const age = today.getFullYear() - date.getFullYear()
      const monthDiff = today.getMonth() - date.getMonth()
      const dayDiff = today.getDate() - date.getDate()
      const actualAge = monthDiff < 0 || (monthDiff === 0 && dayDiff < 0) ? age - 1 : age
      return actualAge >= 18
    },
    { message: 'mustBe18' },
  ),
  privacyConsent: z.boolean().refine((val) => val === true, {
    message: 'mustAcceptPrivacy',
  }),
})

export type MembershipFormData = z.infer<typeof membershipSchema>

export const profileUpdateSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().refine((val) => !val || isValidPhoneNumber(val), {
    message: 'invalidPhone',
  }),
  municipality: z.string().optional(),
})

export type ProfileUpdateFormData = z.infer<typeof profileUpdateSchema>

export const createMemberSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  memberNumber: z.string().optional(),
  phone: z.string().optional(),
  municipality: z.string().optional(),
  dateOfBirth: z.string().optional(),
})

export type CreateMemberFormData = z.infer<typeof createMemberSchema>

export const categorySchema = z.object({
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  nameSv: z.string().min(1),
  nameFi: z.string().optional(),
  nameEn: z.string().optional(),
  sortOrder: z.string().optional(),
})

export type CategoryFormData = z.infer<typeof categorySchema>

export const feePeriodSchema = z.object({
  name: z.string().min(1),
  amount: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
    message: 'Must be a positive number',
  }),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  dueDate: z.string().min(1),
})

export type FeePeriodFormData = z.infer<typeof feePeriodSchema>

export const eventSchema = z.object({
  titleSv: z.string().min(1),
  titleFi: z.string().optional(),
  titleEn: z.string().optional(),
  summarySv: z.string().optional(),
  summaryFi: z.string().optional(),
  summaryEn: z.string().optional(),
  descriptionSv: z.string().optional(),
  descriptionFi: z.string().optional(),
  descriptionEn: z.string().optional(),
  locationSv: z.string().optional(),
  locationFi: z.string().optional(),
  locationEn: z.string().optional(),
  date: z.string().min(1),
  endDate: z.string().optional(),
  categoryId: z.string().optional(),
  capacity: z.string().optional(),
  price: z.string().optional(),
  allocationMethod: z.enum(['first_come', 'lottery']),
  registrationOpensAt: z.string().optional(),
  registrationDeadline: z.string().optional(),
  lotteryDate: z.string().optional(),
  cancellationAllowed: z.string().optional(),
  cancellationDeadline: z.string().optional(),
})

export type EventFormData = z.infer<typeof eventSchema>

export const whiskySchema = z.object({
  name: z.string().min(1),
  distillery: z.string().optional(),
  region: z.string().optional(),
  age: z.string().optional(),
  abv: z.string().optional(),
  notesSv: z.string().optional(),
  notesFi: z.string().optional(),
  notesEn: z.string().optional(),
  sortOrder: z.string().optional(),
})

export type WhiskyFormData = z.infer<typeof whiskySchema>

export const massEmailSchema = z.object({
  subject: z.string().min(1),
  message: z.string().min(1),
  recipientFilter: z.enum(['active', 'all', 'honorary']),
})
export type MassEmailFormData = z.infer<typeof massEmailSchema>

export const settingsSchema = z.object({
  name: z.string().min(1),
  address: z.string().optional(),
  businessId: z.string().optional(),
  iban: z.string().optional(),
  bic: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  nextInvoiceNumber: z.string().refine((val) => {
    const num = Number(val)
    return Number.isInteger(num) && num >= 1
  }, { message: 'Must be a positive integer' }),
})

export type SettingsFormData = z.infer<typeof settingsSchema>
