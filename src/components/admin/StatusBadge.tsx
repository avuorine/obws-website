import { Badge } from '@/components/ui/badge'

interface StatusBadgeProps {
  status: string
  label: string
}

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const variant = (() => {
    switch (status) {
      case 'paid':
      case 'active':
      case 'published':
        return 'success' as const
      case 'unpaid':
      case 'warning':
        return 'warning' as const
      case 'overdue':
      case 'cancelled':
      case 'destructive':
      case 'inactive':
        return 'destructive' as const
      case 'sent':
      case 'completed':
        return 'outline' as const
      default:
        return 'default' as const
    }
  })()

  return <Badge variant={variant}>{label}</Badge>
}
