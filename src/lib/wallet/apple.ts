import { readFileSync } from 'node:fs'
import path from 'node:path'
import { PKPass } from 'passkit-generator'
import type { MembershipCardData } from '@/lib/membership'
import { signApplePassToken, signMemberToken } from '@/lib/membership-token'
import { getSettings } from '@/lib/settings'
import { buildCardContent } from './card-content'

/**
 * Builds a signed Apple Wallet `.pkpass` (storeCard) for a member.
 *
 * Requires these env vars (PEM/cert blobs base64-encoded):
 *   APPLE_PASS_TYPE_ID, APPLE_TEAM_ID, APPLE_PASS_CERT, APPLE_PASS_KEY,
 *   APPLE_PASS_KEY_PASSPHRASE (optional), APPLE_WWDR_CERT
 *
 * Live pass updates (PassKit web service / APNs push) are intentionally not
 * implemented yet — passes are refreshed by re-adding. So no `webServiceURL`.
 */

function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`${name} is not set`)
  return v
}

function decodeB64(name: string): Buffer {
  return Buffer.from(requireEnv(name), 'base64')
}

let logoBuffer: Buffer | null = null
function getLogo(): Buffer {
  if (!logoBuffer) {
    logoBuffer = readFileSync(path.join(process.cwd(), 'public', 'ows_logo_small.png'))
  }
  return logoBuffer
}

function field(key: string, label: string, value: string) {
  return { key, label, value }
}

export async function buildApplePass(
  card: MembershipCardData,
  token: string,
  labels: {
    organizationName: string
    description: string
    member: string
    status: string
    statusValue: string
    memberNumber: string
  },
): Promise<Buffer> {
  const passJson = {
    formatVersion: 1,
    passTypeIdentifier: requireEnv('APPLE_PASS_TYPE_ID'),
    teamIdentifier: requireEnv('APPLE_TEAM_ID'),
    serialNumber: card.memberId,
    organizationName: labels.organizationName,
    description: labels.description,
    logoText: labels.organizationName,
    foregroundColor: 'rgb(73, 42, 13)',
    backgroundColor: 'rgb(244, 230, 206)',
    labelColor: 'rgb(107, 68, 35)',
    // Enables live updates via the PassKit web service (see api/wallet/apple/v1).
    webServiceURL: `${requireEnv('NEXT_PUBLIC_SITE_URL')}/api/wallet/apple`,
    authenticationToken: signApplePassToken(card.memberId),
  }

  const logo = getLogo()
  const pass = new PKPass(
    {
      'pass.json': Buffer.from(JSON.stringify(passJson)),
      'icon.png': logo,
      'icon@2x.png': logo,
      'logo.png': logo,
      'logo@2x.png': logo,
    },
    {
      wwdr: decodeB64('APPLE_WWDR_CERT'),
      signerCert: decodeB64('APPLE_PASS_CERT'),
      signerKey: decodeB64('APPLE_PASS_KEY'),
      signerKeyPassphrase: process.env.APPLE_PASS_KEY_PASSPHRASE,
    },
  )

  pass.type = 'storeCard'
  pass.primaryFields.push(field('name', labels.member, card.fullName))
  if (card.memberNumber != null) {
    pass.secondaryFields.push(field('memberNumber', labels.memberNumber, `#${card.memberNumber}`))
  }
  pass.auxiliaryFields.push(field('status', labels.status, labels.statusValue))
  pass.backFields.push(field('memberId', labels.memberNumber, card.memberId))

  pass.setBarcodes({
    format: 'PKBarcodeFormatQR',
    message: token,
    messageEncoding: 'iso-8859-1',
  })

  return pass.getAsBuffer()
}

/** Builds a signed pass for a member from card data + association settings. */
export async function buildApplePassForMember(
  card: MembershipCardData,
  locale?: string,
): Promise<Buffer> {
  const settings = await getSettings()
  const content = buildCardContent(card, locale)
  const token = signMemberToken({ memberId: card.memberId, memberNumber: card.memberNumber })

  return buildApplePass(card, token, {
    organizationName: settings.name,
    description: `${settings.name} — ${content.title}`,
    member: content.member,
    status: content.status,
    statusValue: content.statusValue,
    memberNumber: content.memberNumber,
  })
}
