import Image from 'next/image'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { LanguageSwitcher } from './LanguageSwitcher'

export function Header() {
  const t = useTranslations('common')

  return (
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="transition-opacity hover:opacity-80">
            <Image
              src="/ows_logo_small.png"
              alt="Österbottens Whiskysällskap"
              width={40}
              height={40}
              className="h-10 w-auto"
            />
          </Link>
          <nav className="flex items-center gap-6">
            <Link href="/" className="text-sm text-whisky-light hover:text-amber">
              {t('home')}
            </Link>
            <Link href="/membership" className="text-sm text-whisky-light hover:text-amber">
              {t('membership')}
            </Link>
            <Link href="/board" className="text-sm text-whisky-light hover:text-amber">
              {t('board')}
            </Link>
            <Link href="/rules" className="text-sm text-whisky-light hover:text-amber">
              {t('rules')}
            </Link>
          </nav>
        </div>
        <LanguageSwitcher />
      </div>
    </header>
  )
}
