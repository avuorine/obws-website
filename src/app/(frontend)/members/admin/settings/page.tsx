import { getTranslations } from 'next-intl/server'
import { requireAdmin } from '@/lib/admin-guard'
import { getSettings } from '@/lib/settings'
import { SettingsForm } from '@/components/admin/SettingsForm'

export default async function AdminSettingsPage() {
  await requireAdmin()
  const t = await getTranslations('admin')
  const settings = await getSettings()

  return (
    <div>
      <h1 className="mb-6 font-serif text-3xl font-bold">{t('settings')}</h1>
      <SettingsForm
        defaultValues={{
          name: settings.name,
          address: settings.address || '',
          businessId: settings.businessId || '',
          iban: settings.iban || '',
          bic: settings.bic || '',
          email: settings.email || '',
          phone: settings.phone || '',
          nextInvoiceNumber: String(settings.nextInvoiceNumber),
        }}
      />
    </div>
  )
}
