import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const alertVariants = cva(
  'rounded-lg border p-4 text-sm',
  {
    variants: {
      variant: {
        default: 'border-input bg-card text-foreground',
        success: 'border-[#a8b5a0] bg-[#e8efe4] text-[#4a6741]',
        destructive: 'border-[#d4a8a8] bg-[#f5ddd2] text-[#a63d2a]',
        warning: 'border-[#d4c4a8] bg-[#f5ead2] text-[#8b6914]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {}

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant, ...props }, ref) => (
    <div ref={ref} role="alert" className={cn(alertVariants({ variant }), className)} {...props} />
  ),
)
Alert.displayName = 'Alert'

export { Alert, alertVariants }
