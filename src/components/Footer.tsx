import { useTranslations } from 'next-intl'
import Link from 'next/link'

export function Footer() {
  const t = useTranslations('common')

  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-4 px-6 py-6 text-center text-sm text-muted-foreground">
        <span>{t('footer', { year: new Date().getFullYear() })}</span>
        <Link href="/privacy" className="underline hover:text-foreground">
          {t('privacyPolicy')}
        </Link>
      </div>
    </footer>
  )
}
