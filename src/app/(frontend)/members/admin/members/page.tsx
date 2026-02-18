import Link from 'next/link'
import { getTranslations, getLocale } from 'next-intl/server'
import { db } from '@/db'
import { user } from '@/db/schema'
import { sql, count } from 'drizzle-orm'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/format-date'
import { Card, CardContent } from '@/components/ui/card'
import { Download } from 'lucide-react'

const PAGE_SIZE = 50

export default async function AdminMembersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const { page: pageParam } = await searchParams
  const t = await getTranslations('admin')
  const locale = await getLocale()

  const currentPage = Math.max(1, parseInt(pageParam ?? '1', 10) || 1)
  const offset = (currentPage - 1) * PAGE_SIZE

  const [members, [{ total }]] = await Promise.all([
    db
      .select()
      .from(user)
      .orderBy(sql`${user.memberNumber} ASC NULLS LAST`)
      .limit(PAGE_SIZE)
      .offset(offset),
    db.select({ total: count() }).from(user),
  ])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const statusVariant = (status: string | null) => {
    switch (status) {
      case 'active': return 'success' as const
      case 'inactive': return 'destructive' as const
      case 'honorary': return 'warning' as const
      default: return 'default' as const
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-serif text-3xl font-bold">{t('allMembers')}</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href="/api/export/members">
              <Download className="mr-1 h-4 w-4" />
              {t('export')}
            </a>
          </Button>
          <Button asChild>
            <Link href="/members/admin/members/new">{t('addMember')}</Link>
          </Button>
        </div>
      </div>

      {members.length === 0 ? (
        <p className="text-muted-foreground">{t('noMembers')}</p>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-input text-left">
                    <th className="px-4 py-3 font-medium">{t('memberNumber')}</th>
                    <th className="px-4 py-3 font-medium">{t('name')}</th>
                    <th className="px-4 py-3 font-medium">{t('email')}</th>
                    <th className="px-4 py-3 font-medium">{t('status')}</th>
                    <th className="px-4 py-3 font-medium">{t('memberSince')}</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => (
                    <tr key={m.id} className="border-b border-input last:border-0">
                      <td className="px-4 py-3 text-muted-foreground">{m.memberNumber ?? '—'}</td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/members/admin/members/${m.id}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {m.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{m.email}</td>
                      <td className="px-4 py-3">
                        <Badge variant={statusVariant(m.status)}>
                          {t(m.status as 'active' | 'inactive' | 'honorary')}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDate(m.memberSince, locale)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-input px-4 py-3">
                <p className="text-sm text-muted-foreground">
                  {t('pageOf', { current: currentPage, total: totalPages })}
                </p>
                <div className="flex gap-2">
                  {currentPage > 1 && (
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/members/admin/members?page=${currentPage - 1}`}>
                        {t('previous')}
                      </Link>
                    </Button>
                  )}
                  {currentPage < totalPages && (
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/members/admin/members?page=${currentPage + 1}`}>
                        {t('next')}
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
