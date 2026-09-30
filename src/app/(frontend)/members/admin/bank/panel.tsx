'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { CheckIcon, ChevronsUpDownIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
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
  const [open, setOpen] = useState(false)
  const [bank, setBank] = useState(defaultBank ?? '')
  const [psuType, setPsuType] = useState<'business' | 'personal'>('business')
  const [account, setAccount] = useState(pick?.accounts[0]?.uid ?? '')
  const [message, setMessage] = useState<{ tone: 'success' | 'destructive'; text: string } | null>(null)

  // Banks that don't list the chosen account type can't be connected with it.
  const visible = banks.filter((b) => b.psuTypes.length === 0 || b.psuTypes.includes(psuType))
  const known = (e?: string) =>
    e && ['bankNotConfigured', 'bankNotFound', 'bankProviderError', 'bankStateInvalid', 'bankNotConnected', 'bankSyncTooSoon', 'bankSyncFailed'].includes(e)
      ? t(e)
      : t('error')

  function changePsuType(next: 'business' | 'personal') {
    setPsuType(next)
    const selected = banks.find((b) => b.name === bank)
    if (selected && selected.psuTypes.length > 0 && !selected.psuTypes.includes(next)) setBank('')
  }

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
          <Label htmlFor="bank-picker">{t('bankChoose')}</Label>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                id="bank-picker"
                type="button"
                variant="outline"
                role="combobox"
                aria-expanded={open}
                className={cn('w-full justify-between font-normal', !bank && 'text-muted-foreground')}
              >
                {bank || t('bankSearch')}
                <ChevronsUpDownIcon className="ml-auto h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
              <Command>
                <CommandInput placeholder={t('bankSearch')} />
                <CommandList>
                  <CommandEmpty>{banks.length === 0 ? t('bankNoBanks') : t('bankNoMatch')}</CommandEmpty>
                  <CommandGroup>
                    {visible.map((b) => (
                      <CommandItem
                        key={b.name}
                        value={b.name}
                        onSelect={() => {
                          setBank(b.name)
                          setOpen(false)
                        }}
                      >
                        <CheckIcon className={cn('mr-2 h-4 w-4', bank === b.name ? 'opacity-100' : 'opacity-0')} />
                        {b.name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
        <div className="space-y-1">
          <Label htmlFor="psu-type">{t('bankAccountType')}</Label>
          <select id="psu-type" className={selectClass} value={psuType} onChange={(e) => changePsuType(e.target.value as 'business' | 'personal')}>
            <option value="business">{t('bankBusiness')}</option>
            <option value="personal">{t('bankPersonal')}</option>
          </select>
        </div>
      </div>

      {banks.length === 0 && <Alert variant="warning">{t('bankNoBanks')}</Alert>}

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
