import { z } from 'zod'
import { isValidPhoneNumber } from 'react-phone-number-input'

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
})

export type MembershipFormData = z.infer<typeof membershipSchema>
