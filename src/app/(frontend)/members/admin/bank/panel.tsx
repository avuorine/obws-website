'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { chooseBankAccount, disconnectBank, startBankConnection, syncBankNow } from './actions'

interface Props {
  banks: { name: string; country: string; psuTypes: string[] }[]
  defaultBank: string | null
  connected: boolean
  pick: { state: string; accounts: { uid: string; iban: string | null; name: string | null }[] } | null
}

const selectClass = 'h-10 w-full rounded-lg border border-input bg-background px-3 text-sm'

export function BankConnectionPanel({ banks, defaultBank, connected, pick }: Props) {
  const t = useTranslations('admin')
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [filter, setFilter] = useState('')
  const [bank, setBank] = useState(defaultBank ?? '')
  const [psuType, setPsuType] = useState<'business' | 'personal'>('business')
  const [account, setAccount] = useState(pick?.accounts[0]?.uid ?? '')
  const [message, setMessage] = useState<{ tone: 'success' | 'destructive'; text: string } | null>(null)

  const visible = banks.filter((b) => b.name.toLowerCase().includes(filter.toLowerCase()))
  const known = (e?: string) =>
    e && ['bankNotConfigured', 'bankNotFound', 'bankProviderError', 'bankStateInvalid', 'bankNotConnected', 'bankSyncTooSoon', 'bankSyncFailed'].includes(e)
      ? t(e)
      : t('error')

  function connect() {
    setMessage(null)
    startTransition(async () => {
      const res = await startBankConnection(bank, 'FI', psuType)
      if (res.url) window.location.href = res.url
      else setMessage({ tone: 'destructive', text: known(res.error) })
    })
  }

  function choose() {
    startTransition(async () => {
      const res = await chooseBankAccount(pick!.state, account)
      if (res.success) router.replace('/members/admin/bank?connected=1')
      else setMessage({ tone: 'destructive', text: known(res.error) })
    })
  }

  function sync() {
    setMessage(null)
    startTransition(async () => {
      const res = await syncBankNow()
      if (res.success && res.result) {
        setMessage({ tone: 'success', text: t('bankSyncResult', res.result) })
        router.refresh()
      } else setMessage({ tone: 'destructive', text: known(res.error) })
    })
  }

  function disconnect() {
    if (!confirm(t('bankConfirmDisconnect'))) return
    startTransition(async () => {
      await disconnectBank()
      router.refresh()
    })
  }

  if (pick) {
    return (
      <div className="space-y-3">
        <p className="text-sm">{t('bankPickAccount')}</p>
        <select className={selectClass} value={account} onChange={(e) => setAccount(e.target.value)}>
          {pick.accounts.map((a) => (
            <option key={a.uid} value={a.uid}>
              {[a.name, a.iban].filter(Boolean).join(' · ') || a.uid}
            </option>
          ))}
        </select>
        <Button onClick={choose} disabled={isPending || !account}>
          {t('bankUseAccount')}
        </Button>
        {message && <Alert variant={message.tone}>{message.text}</Alert>}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="bank-filter">{t('bankChoose')}</Label>
          <Input id="bank-filter" placeholder={t('bankSearch')} value={filter} onChange={(e) => setFilter(e.target.value)} />
          <select className={selectClass} value={bank} onChange={(e) => setBank(e.target.value)} aria-label={t('bankChoose')}>
            <option value="">—</option>
            {visible.map((b) => (
              <option key={b.name} value={b.name}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="psu-type">{t('bankAccountType')}</Label>
          <select id="psu-type" className={selectClass} value={psuType} onChange={(e) => setPsuType(e.target.value as 'business' | 'personal')}>
            <option value="business">{t('bankBusiness')}</option>
            <option value="personal">{t('bankPersonal')}</option>
          </select>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={connect} disabled={isPending || !bank}>
          {connected ? t('bankRenew') : t('bankConnect')}
        </Button>
        {connected && (
          <>
            <Button variant="outline" onClick={sync} disabled={isPending}>
              {isPending ? t('bankSyncing') : t('bankSyncNow')}
            </Button>
            <Button variant="destructive" onClick={disconnect} disabled={isPending}>
              {t('bankDisconnect')}
            </Button>
          </>
        )}
      </div>
      {message && <Alert variant={message.tone}>{message.text}</Alert>}
    </div>
  )
}
