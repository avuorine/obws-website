import { getTranslations } from 'next-intl/server'
import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { Alert } from '@/components/ui/alert'
import { getOverdueBalance } from '@/lib/overdue-balance'
import { getSettings } from '@/lib/settings'

/** Shown across the members area while the member has overdue invoices. */
export async function OverdueBanner({ userId }: { userId: string }) {
  const balance = await getOverdueBalance(userId)
  if (!balance) return null

  const t = await getTranslations('events')
  const contactEmail = (await getSettings()).email || null

  return (
    <Alert variant="warning" role="alert" className="flex gap-3">
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
      <div className="space-y-1">
        <p className="font-semibold">
          {t('overdueBannerTitle', { count: balance.count, total: balance.total.toFixed(2) })}
        </p>
        <p>{t('overdueBannerBody')}</p>
        <p>
          <Link href="/members/invoices" className="font-medium underline">
            {t('overdueViewInvoices')}
          </Link>
        </p>
        {contactEmail && (
          <p>
            {t('overdueContact')}{' '}
            <a href={`mailto:${contactEmail}`} className="underline">
              {contactEmail}
            </a>
          </p>
        )}
      </div>
    </Alert>
  )
}
