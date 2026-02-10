'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { LayoutDashboard, Calendar, UserCircle, UserPlus, Receipt, FileText, Tags, Mail, Settings } from 'lucide-react'
import { Separator } from '@/components/ui/separator'

interface MembersNavProps {
  isAdmin?: boolean
}

export function MembersNav({ isAdmin }: MembersNavProps) {
  const t = useTranslations()
  const pathname = usePathname()

  const links = [
    { href: '/members', label: t('membersDashboard.title'), icon: LayoutDashboard },
    { href: '/members/events', label: t('events.title'), icon: Calendar },
    { href: '/members/profile', label: t('profile.title'), icon: UserCircle },
  ]

  const adminLinks = [
    { href: '/members/admin/members', label: t('admin.members'), icon: UserPlus },
    { href: '/members/admin/events', label: t('admin.allEvents'), icon: Calendar },
    { href: '/members/admin/categories', label: t('admin.categories'), icon: Tags },
    { href: '/members/admin/fees', label: t('admin.fees'), icon: Receipt },
    { href: '/members/admin/invoices', label: t('admin.invoices'), icon: FileText },
    { href: '/members/admin/mass-email', label: t('admin.massEmail'), icon: Mail },
    { href: '/members/admin/settings', label: t('admin.settings'), icon: Settings },
  ]

  const isActive = (href: string) =>
    href === '/members' ? pathname === href : pathname.startsWith(href)

  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-input pb-3 md:flex-col md:gap-0 md:border-b-0 md:border-r md:pb-0 md:pr-6">
      {links.map((link) => {
        const Icon = link.icon
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              'flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground',
              isActive(link.href)
                ? 'bg-accent font-medium text-primary'
                : 'text-muted-foreground',
            )}
          >
            <Icon className="h-4 w-4" />
            {link.label}
          </Link>
        )
      })}

      {isAdmin && (
        <>
          <Separator label={t('admin.title')} className="my-2" />
          {adminLinks.map((link) => {
            const Icon = link.icon
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground',
                  isActive(link.href)
                    ? 'bg-accent font-medium text-primary'
                    : 'text-muted-foreground',
                )}
              >
                <Icon className="h-4 w-4" />
                {link.label}
              </Link>
            )
          })}
        </>
      )}
    </nav>
  )
}
