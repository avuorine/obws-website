'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Menu } from 'lucide-react'
import { authClient } from '@/lib/auth-client'
import { LanguageSwitcher } from './LanguageSwitcher'
import { HeaderAuth } from './HeaderAuth'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'

export function Header() {
  const t = useTranslations('common')
  const router = useRouter()
  const pathname = usePathname()
  const { data: session } = authClient.useSession()
  const [open, setOpen] = useState(false)

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href)

  const navLinks = [
    { href: '/', label: t('home') },
    { href: '/membership', label: t('membership') },
    { href: '/board', label: t('board') },
    { href: '/rules', label: t('rules') },
  ]

  return (
    <header className="border-b border-input">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2">
          <Link href="/" className="transition-opacity hover:opacity-80">
            <Image
              src="/ows_logo_small.png"
              alt="Österbottens Whiskysällskap"
              width={40}
              height={40}
              className="h-10 w-auto"
            />
          </Link>
          <nav className="hidden items-center md:flex">
            {navLinks.map((link) => (
              <Button
                key={link.href}
                variant="ghost"
                size="sm"
                className={isActive(link.href) ? 'bg-accent' : ''}
                asChild
              >
                <Link href={link.href}>{link.label}</Link>
              </Button>
            ))}
          </nav>
        </div>

        {/* Desktop actions */}
        <div className="hidden items-center gap-4 md:flex">
          <HeaderAuth />
          <LanguageSwitcher />
        </div>

        {/* Mobile menu */}
        <div className="md:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-64">
              <SheetHeader>
                <SheetTitle className="text-left">{t('menu')}</SheetTitle>
              </SheetHeader>
              <nav className="mt-6 flex flex-col gap-1">
                {navLinks.map((link) => (
                  <Button
                    key={link.href}
                    variant="ghost"
                    className={`justify-start ${isActive(link.href) ? 'bg-accent' : ''}`}
                    asChild
                    onClick={() => setOpen(false)}
                  >
                    <Link href={link.href}>{link.label}</Link>
                  </Button>
                ))}
                {session ? (
                  <>
                    <Button
                      variant="ghost"
                      className={`justify-start ${isActive('/members') ? 'bg-accent' : ''}`}
                      asChild
                      onClick={() => setOpen(false)}
                    >
                      <Link href="/members">{t('members')}</Link>
                    </Button>
                    <Button
                      variant="ghost"
                      className="justify-start"
                      onClick={async () => {
                        setOpen(false)
                        await authClient.signOut()
                        router.push('/')
                        router.refresh()
                      }}
                    >
                      {t('logout')}
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="ghost"
                    className="justify-start"
                    asChild
                    onClick={() => setOpen(false)}
                  >
                    <Link href="/login">{t('login')}</Link>
                  </Button>
                )}
                <div className="mt-4 border-t pt-4">
                  <LanguageSwitcher />
                </div>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
