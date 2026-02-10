import * as React from 'react'
import { cn } from '@/lib/utils'

interface SeparatorProps extends React.HTMLAttributes<HTMLDivElement> {
  label?: string
}

const Separator = React.forwardRef<HTMLDivElement, SeparatorProps>(
  ({ className, label, ...props }, ref) => {
    if (label) {
      return (
        <div ref={ref} className={cn('relative py-2', className)} {...props}>
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-input" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-background px-2 text-muted-foreground">{label}</span>
          </div>
        </div>
      )
    }
    return (
      <div
        ref={ref}
        className={cn('h-px w-full bg-input', className)}
        {...props}
      />
    )
  },
)
Separator.displayName = 'Separator'

export { Separator }
