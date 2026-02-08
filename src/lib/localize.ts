import type { LocalizedText } from '@/db/schema'

export function getLocalized(
  jsonb: LocalizedText | null | undefined,
  locale: string,
): string {
  if (!jsonb) return ''
  const loc = locale as keyof LocalizedText
  return jsonb[loc] ?? jsonb.sv ?? jsonb.en ?? ''
}
