'use client'

import { useState, useTransition, useRef } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import dynamic from 'next/dynamic'
import { massEmailSchema, type MassEmailFormData } from '@/lib/validation'
import { sendTestEmail, sendMassEmail } from '@/app/(frontend)/members/admin/mass-email/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Alert } from '@/components/ui/alert'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const TiptapEditor = dynamic(() => import('@/components/admin/TiptapEditor'), { ssr: false })

interface MassEmailFormProps {
  counts: { active: number; honorary: number; total: number }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function MassEmailForm({ counts }: MassEmailFormProps) {
  const t = useTranslations('admin')
  const [isSendingTest, startTestTransition] = useTransition()
  const [isSendingAll, startMassTransition] = useTransition()
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { register, handleSubmit, control, watch, formState: { errors } } = useForm<MassEmailFormData>({
    resolver: zodResolver(massEmailSchema),
    defaultValues: { subject: '', message: '', recipientFilter: 'active' },
  })

  const filter = watch('recipientFilter')
  const recipientCount = filter === 'active' ? counts.active : filter === 'honorary' ? counts.honorary : counts.total

  function buildFormData(data: MassEmailFormData): FormData {
    const fd = new FormData()
    fd.set('subject', data.subject)
    fd.set('message', data.message)
    fd.set('recipientFilter', data.recipientFilter)
    for (const file of files) {
      fd.append('attachments', file)
    }
    return fd
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      setFiles((prev) => [...prev, ...Array.from(e.target.files!)])
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  function onSendTest(data: MassEmailFormData) {
    setError('')
    setMessage('')
    startTestTransition(async () => {
      const result = await sendTestEmail(buildFormData(data))
      if (result.success) {
        setMessage(t('testEmailSent'))
      } else {
        setError(result.error ?? t('error'))
      }
    })
  }

  function onSendAll(data: MassEmailFormData) {
    if (!confirm(t('confirmMassSend', { count: recipientCount }))) return
    setError('')
    setMessage('')
    startMassTransition(async () => {
      const result = await sendMassEmail(buildFormData(data))
      if (result.success) {
        setMessage(t('massEmailSent', { count: result.count }))
      } else {
        setError(result.error ?? t('error'))
      }
    })
  }

  return (
    <form className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('composeMessage')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="recipientFilter">{t('recipients')}</Label>
            <Select id="recipientFilter" {...register('recipientFilter')}>
              <option value="active">{t('activeMembers')} ({counts.active})</option>
              <option value="honorary">{t('honoraryMembers')} ({counts.honorary})</option>
              <option value="all">{t('allMembers')} ({counts.total})</option>
            </Select>
            <p className="mt-1 text-xs text-muted-foreground">
              {t('willSendTo', { count: recipientCount })}
            </p>
          </div>

          <div>
            <Label htmlFor="subject">{t('emailSubject')}</Label>
            <Input id="subject" {...register('subject')} />
            {errors.subject && <p className="mt-1 text-xs text-red-600">{errors.subject.message}</p>}
          </div>

          <div>
            <Label>{t('emailBody')}</Label>
            <Controller
              name="message"
              control={control}
              render={({ field }) => (
                <TiptapEditor content={field.value} onChange={field.onChange} />
              )}
            />
            {errors.message && <p className="mt-1 text-xs text-red-600">{errors.message.message}</p>}
          </div>

          <div>
            <Label>{t('attachments')}</Label>
            <div className="mt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                {t('addFiles')}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
            {files.length > 0 && (
              <ul className="mt-2 space-y-1">
                {files.map((file, i) => (
                  <li key={`${file.name}-${i}`} className="flex items-center gap-2 text-sm">
                    <span className="truncate">{file.name}</span>
                    <span className="text-muted-foreground shrink-0">({formatFileSize(file.size)})</span>
                    <button
                      type="button"
                      onClick={() => removeFile(i)}
                      className="text-red-600 hover:text-red-800 text-xs shrink-0"
                    >
                      {t('removeFile')}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>

      {error && <Alert variant="destructive">{error}</Alert>}
      {message && <Alert variant="success">{message}</Alert>}

      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          disabled={isSendingTest || isSendingAll}
          onClick={handleSubmit(onSendTest)}
        >
          {isSendingTest ? t('sendingTest') : t('sendTest')}
        </Button>
        <Button
          type="button"
          disabled={isSendingTest || isSendingAll}
          onClick={handleSubmit(onSendAll)}
        >
          {isSendingAll ? t('sendingAll') : t('sendToAll')}
        </Button>
      </div>
    </form>
  )
}
