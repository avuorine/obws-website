'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'

export function MembersNav() {
  const t = useTranslations()
  const pathname = usePathname()

  const links = [
    { href: '/members', label: t('membersDashboard.title') },
    { href: '/members/events', label: t('events.title') },
    { href: '/members/directory', label: t('directory.title') },
    { href: '/members/profile', label: t('profile.title') },
  ]

  return (
    <nav className="mb-8 flex gap-4 border-b border-border pb-4">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={`text-sm transition-colors ${
            pathname === link.href
              ? 'font-medium text-amber'
              : 'text-whisky-light hover:text-amber'
          }`}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  )
}
