import Image from 'next/image'

export function Logo({ className }: { className?: string }) {
  return (
    <Image
      src="/ows_logo_small.png"
      alt="Österbottens Whiskysällskap"
      width={200}
      height={200}
      className={className}
      priority
    />
  )
}
