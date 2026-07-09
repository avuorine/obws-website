import Image from 'next/image'

interface MembershipCardProps {
  associationName: string
  fullName: string
  memberNumber: number | null
  /** Localized status label, e.g. "Active" / "Honorary". */
  statusLabel: string
  /** Localized "Member" word shown next to the member number. */
  memberLabel: string
  statusFieldLabel: string
  memberSinceLabel: string
  memberSinceValue: string
  /** When false (inactive), the status value is styled as a warning. */
  isValid: boolean
  qrDataUrl: string
}

export function MembershipCard({
  associationName,
  fullName,
  memberNumber,
  statusLabel,
  memberLabel,
  statusFieldLabel,
  memberSinceLabel,
  memberSinceValue,
  isValid,
  qrDataUrl,
}: MembershipCardProps) {
  return (
    <div className="w-full max-w-md overflow-hidden rounded-xl bg-card text-foreground shadow-lg border border-border">
      <div className="flex flex-col gap-6 p-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Image
            src="/ows_logo_small.png"
            alt={associationName}
            width={64}
            height={64}
            className="h-16 w-auto shrink-0"
          />
          <div className="flex flex-col justify-center font-serif text-[24px] font-extrabold tracking-wider leading-[1.1] text-whisky">
            <div>ÖSTERBOTTENS</div>
            <div>WHISKYSÄLLSKAP</div>
          </div>
        </div>

        {/* Identity + QR */}
        <div className="flex items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="truncate font-serif text-xl font-bold uppercase tracking-wide text-whisky">
              {fullName}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {memberLabel}
              {memberNumber != null && ` · #${memberNumber}`}
            </p>

            <dl className="mt-4 space-y-1 text-sm">
              <div className="flex gap-2">
                <dt className="text-muted-foreground">{statusFieldLabel}</dt>
                <dd className={isValid ? 'font-medium text-whisky' : 'font-medium text-amber'}>{statusLabel}</dd>
              </div>
              {memberSinceValue && (
                <div className="flex gap-2">
                  <dt className="text-muted-foreground">{memberSinceLabel}</dt>
                  <dd className="font-medium text-whisky">{memberSinceValue}</dd>
                </div>
              )}
            </dl>
          </div>

          <div className="shrink-0 rounded-lg bg-white p-2 border border-border shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrDataUrl} alt="" width={96} height={96} className="h-24 w-24" />
          </div>
        </div>
      </div>
    </div>
  )
}
