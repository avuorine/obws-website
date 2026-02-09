import { createHmac } from 'crypto'

export function generateUnsubscribeToken(userId: string): string {
  return createHmac('sha256', process.env.BETTER_AUTH_SECRET!)
    .update(userId)
    .digest('hex')
}

export function generateUnsubscribeUrl(userId: string): string {
  const token = generateUnsubscribeToken(userId)
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL!
  return `${siteUrl}/api/unsubscribe?token=${token}&uid=${userId}`
}
