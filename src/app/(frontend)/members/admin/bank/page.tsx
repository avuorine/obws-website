import { getTranslations, getLocale } from 'next-intl/server'
import { unstable_cache } from 'next/cache'
import { requireAdmin } from '@/lib/admin-guard'
import { db } from '@/db'
import { bankAuthStates } from '@/db/schema'
import { and, eq, gt } from 'drizzle-orm'
import { isConfigured, listAspsps } from '@/lib/enablebanking'
import { currentConnection } from '@/lib/bank-connection'
import { formatDate, formatDateTime } from '@/lib/format-date'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { BankConnectionPanel } from './panel'

// The bank list changes rarely; don't hit the provider on every page view.
const cachedAspsps = unstable_cache(
  async (country: string) =>
    (await listAspsps(country)).map((a) => ({ name: a.name, country: a.country, psuTypes: a.psu_types ?? [] })),
  ['enablebanking-aspsps'],
  { revalidate: 3600 },
)

const KNOWN_ERRORS = ['bankStateInvalid', 'bankAuthCancelled', 'bankNoAccounts', 'bankProviderError'] as const

export default async function BankConnectionPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string; pick?: string }>
}) {
  const admin = await requireAdmin()
  const t = await getTranslations('admin')
  const locale = await getLocale()
  const params = await searchParams

  if (!isConfigured()) {
    return (
      <div>
        <h1 className="mb-6 font-serif text-3xl font-bold">{t('bankConnection')}</h1>
        <Alert>{t('bankNotConfiguredHelp')}</Alert>
      </div>
    )
  }

  const connection = await currentConnection()
  let banks: { name: string; country: string; psuTypes: string[] }[] = []
  let banksError = false
  try {
    banks = await cachedAspsps('FI')
  } catch {
    banksError = true
  }

  // Account choice after the bank redirect, only for the admin who started it.
  const pick = params.pick
    ? await db
        .select()
        .from(bankAuthStates)
        .where(
          and(
            eq(bankAuthStates.state, params.pick),
            eq(bankAuthStates.userId, admin.id),
            gt(bankAuthStates.expiresAt, new Date()),
          ),
        )
        .then((r) => r[0] ?? null)
    : null

  const daysLeft = connection ? Math.ceil((connection.validUntil.getTime() - Date.now()) / 86_400_000) : null
  const expiringSoon = connection?.status === 'active' && daysLeft !== null && daysLeft <= 14
  const error = KNOWN_ERRORS.find((e) => e === params.error)

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-3xl font-bold">{t('bankConnection')}</h1>

      {params.connected && <Alert variant="success">{t('bankConnected')}</Alert>}
      {error && <Alert variant="destructive">{t(error)}</Alert>}
      {connection && connection.status !== 'active' && (
        <Alert variant="destructive">{t('bankConnectionEnded')}</Alert>
      )}
      {expiringSoon && <Alert variant="warning">{t('bankExpiringSoon', { days: daysLeft })}</Alert>}

      {connection && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle>{connection.aspspName}</CardTitle>
              <Badge variant={connection.status === 'active' ? 'success' : 'destructive'}>
                {t(`bankStatus_${connection.status}`)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">{t('bankAccount')}</dt>
                <dd className="font-mono">{connection.iban ?? connection.accountName ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t('bankValidUntil')}</dt>
                <dd>
                  {formatDate(connection.validUntil, locale)}
                  {connection.status === 'active' && daysLeft !== null && daysLeft > 0 && (
                    <span className="text-muted-foreground"> · {t('bankDaysLeft', { days: daysLeft })}</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t('bankLastSync')}</dt>
                <dd>{connection.lastSyncedAt ? formatDateTime(connection.lastSyncedAt, locale) : '—'}</dd>
              </div>
              {connection.lastSyncError && (
                <div>
                  <dt className="text-muted-foreground">{t('bankLastError')}</dt>
                  <dd className="text-[#a63d2a]">{connection.lastSyncError}</dd>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{connection ? t('bankRenewTitle') : t('bankConnectTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          {banksError ? (
            <Alert variant="destructive">{t('bankProviderError')}</Alert>
          ) : (
            <BankConnectionPanel
              banks={banks}
              defaultBank={connection?.aspspName ?? null}
              connected={connection?.status === 'active'}
              pick={pick?.accounts ? { state: pick.state, accounts: pick.accounts } : null}
            />
          )}
          <p className="mt-4 text-xs text-muted-foreground">{t('bankConsentHelp')}</p>
        </CardContent>
      </Card>
    </div>
  )
}
