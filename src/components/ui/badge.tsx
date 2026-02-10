import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium',
  {
    variants: {
      variant: {
        default: 'border-amber/30 bg-primary/10 text-primary',
        success: 'border-[#a8b5a0] bg-[#e8efe4] text-[#4a6741]',
        warning: 'border-[#d4c4a8] bg-[#f5ead2] text-[#8b6914]',
        destructive: 'border-[#d4a8a8] bg-[#f5ddd2] text-[#a63d2a]',
        outline: 'border-input bg-transparent text-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
