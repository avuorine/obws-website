import { Apple, Wallet } from 'lucide-react'

interface WalletButtonsProps {
  appleLabel: string
  googleLabel: string
}

/**
 * "Add to Apple/Google Wallet" buttons. Plain links to the wallet API routes —
 * Apple downloads a .pkpass, Google redirects to the save URL. These styled
 * buttons can later be swapped for the official wallet badge images.
 */
export function WalletButtons({ appleLabel, googleLabel }: WalletButtonsProps) {
  return (
    <div className="flex flex-wrap gap-3">
      <a
        href="/api/wallet/apple"
        className="inline-flex items-center gap-2 rounded-lg bg-black px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-black/80"
      >
        <Apple className="h-5 w-5" />
        {appleLabel}
      </a>
      <a
        href="/api/wallet/google"
        className="inline-flex items-center gap-2 rounded-lg bg-black px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-black/80"
      >
        <Wallet className="h-5 w-5" />
        {googleLabel}
      </a>
    </div>
  )
}
