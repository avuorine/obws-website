import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getTranslations, getLocale } from 'next-intl/server'
import { requireAdmin } from '@/lib/admin-guard'
import { db } from '@/db'
import { user, memberFees, feePeriods } from '@/db/schema'
import { eq, desc } from 'drizzle-orm'
import { formatDate } from '@/lib/format-date'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EditMemberForm } from '@/components/admin/EditMemberForm'
import { ArrowLeft } from 'lucide-react'

export default async function EditMemberPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin()
  const { id } = await params
  const t = await getTranslations('admin')
  const locale = await getLocale()

  const member = await db.select().from(user).where(eq(user.id, id)).then((r) => r[0])
  if (!member) notFound()

  const fees = await db
    .select({
      id: memberFees.id,
      status: memberFees.status,
      paidAt: memberFees.paidAt,
      periodName: feePeriods.name,
      amount: feePeriods.amount,
    })
    .from(memberFees)
    .innerJoin(feePeriods, eq(memberFees.feePeriodId, feePeriods.id))
    .where(eq(memberFees.userId, id))
    .orderBy(desc(feePeriods.startDate))

  const statusVariant = (status: string) => {
    switch (status) {
      case 'paid': return 'success' as const
      case 'unpaid': return 'warning' as const
      case 'overdue': return 'destructive' as const
      default: return 'default' as const
    }
  }

  return (
    <div>
      <Link
        href="/members/admin/members"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('back')}
      </Link>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{t('editMember')}</CardTitle>
          {member.resignedAt && (
            <p className="text-sm text-muted-foreground">
              {t('resignedAt')}: {formatDate(member.resignedAt, locale)}
            </p>
          )}
        </CardHeader>
        <CardContent>
          <EditMemberForm
            key={member.id}
            currentUserId={admin.id}
            member={{
              id: member.id,
              firstName: member.firstName,
              lastName: member.lastName,
              email: member.email,
              memberNumber: member.memberNumber,
              phone: member.phone,
              municipality: member.municipality,
              dateOfBirth: member.dateOfBirth,
              status: member.status,
              role: member.role,
            }}
          />
        </CardContent>
      </Card>

      {fees.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t('memberFees')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-input text-left">
                    <th className="px-4 py-3 font-medium">{t('periodName')}</th>
                    <th className="px-4 py-3 font-medium">{t('amount')}</th>
                    <th className="px-4 py-3 font-medium">{t('status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {fees.map((fee) => (
                    <tr key={fee.id} className="border-b border-input last:border-0">
                      <td className="px-4 py-3">{fee.periodName}</td>
                      <td className="px-4 py-3">€{fee.amount}</td>
                      <td className="px-4 py-3">
                        <Badge variant={statusVariant(fee.status)}>
                          {t(fee.status as 'paid' | 'unpaid' | 'overdue')}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
