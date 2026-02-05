import { useTranslations } from 'next-intl'

export function Footer() {
  const t = useTranslations('common')

  return (
    <footer className="border-t border-border">
      <div className="mx-auto max-w-3xl px-6 py-6 text-center text-sm text-whisky-light">
        {t('footer', { year: new Date().getFullYear() })}
      </div>
    </footer>
  )
}
