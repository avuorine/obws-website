import jwt from 'jsonwebtoken'
import { GoogleAuth } from 'google-auth-library'
import type { MembershipCardData } from '@/lib/membership'

/**
 * Google Wallet generic pass. Issuance uses a signed "Save to Google Wallet"
 * JWT (no pre-insert needed); the GenericClass is inserted once (idempotent).
 *
 * Requires env vars:
 *   GOOGLE_WALLET_ISSUER_ID, GOOGLE_WALLET_SA_EMAIL, GOOGLE_WALLET_SA_PRIVATE_KEY,
 *   GOOGLE_WALLET_CLASS_SUFFIX, NEXT_PUBLIC_SITE_URL
 */

const WALLET_API = 'https://walletobjects.googleapis.com/walletobjects/v1'
const SCOPE = 'https://www.googleapis.com/auth/wallet_object.issuer'

function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`${name} is not set`)
  return v
}

function privateKey(): string {
  // Allow the PEM to be stored with literal "\n" sequences in the env var.
  return requireEnv('GOOGLE_WALLET_SA_PRIVATE_KEY').replace(/\\n/g, '\n')
}

function issuerId(): string {
  return requireEnv('GOOGLE_WALLET_ISSUER_ID')
}

function classId(): string {
  return `${issuerId()}.${requireEnv('GOOGLE_WALLET_CLASS_SUFFIX')}`
}

function objectId(memberId: string): string {
  return `${issuerId()}.${memberId.replace(/[^\w.-]/g, '_')}`
}

async function authedClient() {
  const auth = new GoogleAuth({
    credentials: { client_email: requireEnv('GOOGLE_WALLET_SA_EMAIL'), private_key: privateKey() },
    scopes: [SCOPE],
  })
  return auth.getClient()
}

function statusOf(err: unknown): number | undefined {
  return (err as { response?: { status?: number } })?.response?.status
}

/** Inserts the shared GenericClass if it does not already exist (ignores 409). */
export async function ensureGenericClass(): Promise<void> {
  const client = await authedClient()
  const id = classId()

  try {
    await client.request({ url: `${WALLET_API}/genericClass/${id}`, method: 'GET' })
    return // already exists
  } catch {
    // fall through to insert
  }

  try {
    await client.request({
      url: `${WALLET_API}/genericClass`,
      method: 'POST',
      data: { id },
    })
  } catch (err: unknown) {
    if (statusOf(err) !== 409) throw err
  }
}

export interface GoogleCardLabels {
  organizationName: string
  member: string
  status: string
  statusValue: string
}

/** Builds the GenericObject for a member; shared by save-URL and PATCH. */
function buildGenericObject(
  card: MembershipCardData,
  token: string,
  labels: GoogleCardLabels,
): Record<string, unknown> {
  const siteUrl = requireEnv('NEXT_PUBLIC_SITE_URL')

  return {
    id: objectId(card.memberId),
    classId: classId(),
    state: card.isValid ? 'ACTIVE' : 'INACTIVE',
    hexBackgroundColor: '#f4e6ce',
    logo: {
      sourceUri: { uri: `${siteUrl}/ows_logo_small.png` },
      contentDescription: { defaultValue: { language: 'en', value: labels.organizationName } },
    },
    cardTitle: { defaultValue: { language: 'en', value: labels.organizationName } },
    header: { defaultValue: { language: 'en', value: card.fullName } },
    subheader: {
      defaultValue: {
        language: 'en',
        value: card.memberNumber != null ? `${labels.member} · #${card.memberNumber}` : labels.member,
      },
    },
    textModulesData: [{ id: 'status', header: labels.status, body: labels.statusValue }],
    barcode: { type: 'QR_CODE', value: token },
  }
}

export function buildSaveUrl(
  card: MembershipCardData,
  token: string,
  labels: GoogleCardLabels,
): string {
  const siteUrl = requireEnv('NEXT_PUBLIC_SITE_URL')
  const genericObject = buildGenericObject(card, token, labels)

  const claims = {
    iss: requireEnv('GOOGLE_WALLET_SA_EMAIL'),
    aud: 'google',
    typ: 'savetowallet',
    origins: [siteUrl],
    payload: { genericObjects: [genericObject] },
  }

  const signed = jwt.sign(claims, privateKey(), { algorithm: 'RS256' })
  return `https://pay.google.com/gp/v/save/${signed}`
}

/**
 * Updates an already-saved member's GenericObject (state, content). No-op if the
 * member never saved the card to Google Wallet (404). Saved cards refresh
 * automatically — no push needed.
 */
export async function patchGenericObject(
  card: MembershipCardData,
  token: string,
  labels: GoogleCardLabels,
): Promise<void> {
  const client = await authedClient()
  try {
    await client.request({
      url: `${WALLET_API}/genericObject/${objectId(card.memberId)}`,
      method: 'PATCH',
      data: buildGenericObject(card, token, labels),
    })
  } catch (err: unknown) {
    if (statusOf(err) === 404) return // member has not saved the card
    throw err
  }
}
