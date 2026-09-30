import { createSign } from 'crypto'

/**
 * Minimal Enable Banking (PSD2 account information) client. Server only:
 * it reads the private key from the environment.
 * Docs: https://enablebanking.com/docs/api/reference/
 *
 * Credentials are server-wide env vars: ENABLEBANKING_APP_ID and
 * ENABLEBANKING_PRIVATE_KEY (PEM, or the PEM base64-encoded).
 */

const API = 'https://api.enablebanking.com'
const DAY_S = 24 * 60 * 60

export class EnableBankingError extends Error {
  constructor(
    readonly status: number,
    readonly summary: string,
  ) {
    super(`Enable Banking ${status}: ${summary}`)
  }
}

export function isConfigured(): boolean {
  return Boolean(process.env.ENABLEBANKING_APP_ID && process.env.ENABLEBANKING_PRIVATE_KEY)
}

function privateKey(): string {
  const raw = process.env.ENABLEBANKING_PRIVATE_KEY ?? ''
  return raw.includes('BEGIN') ? raw.replace(/\\n/g, '\n') : Buffer.from(raw, 'base64').toString('utf8')
}

const b64url = (input: string | Buffer) => Buffer.from(input).toString('base64url')

/** RS256 JWT as Enable Banking expects: kid = application id, fixed iss/aud. */
export function ebJwt(appId: string, pem: string, now: Date = new Date(), ttlSeconds = 3600): string {
  const iat = Math.floor(now.getTime() / 1000)
  const header = b64url(JSON.stringify({ typ: 'JWT', alg: 'RS256', kid: appId }))
  const body = b64url(
    JSON.stringify({ iss: 'enablebanking.com', aud: 'api.enablebanking.com', iat, exp: iat + ttlSeconds }),
  )
  const signature = createSign('RSA-SHA256').update(`${header}.${body}`).sign(pem)
  return `${header}.${body}.${b64url(signature)}`
}

async function call<T>(method: 'GET' | 'POST' | 'DELETE', path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${ebJwt(process.env.ENABLEBANKING_APP_ID!, privateKey())}`,
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
  })
  if (!res.ok) {
    // Keep the message short and free of anything secret.
    const text = (await res.text().catch(() => '')).slice(0, 300)
    let summary = text
    try {
      const json = JSON.parse(text) as { message?: string; error?: string }
      summary = json.message ?? json.error ?? text
    } catch {}
    throw new EnableBankingError(res.status, summary || res.statusText)
  }
  return (res.status === 204 ? undefined : await res.json()) as T
}

// --- Types (only the fields we use) ---

export interface Aspsp {
  name: string
  country: string
  logo?: string
  psu_types?: string[]
  /** Seconds; most banks allow 180 days. */
  maximum_consent_validity?: number
}

export interface SessionAccount {
  uid: string
  account_id?: { iban?: string }
  name?: string
  currency?: string
}

export interface EbTransaction {
  entry_reference?: string | null
  transaction_id?: string | null
  transaction_amount: { currency: string; amount: string }
  credit_debit_indicator: 'CRDT' | 'DBIT'
  status: 'BOOK' | 'PDNG' | string
  booking_date?: string | null
  value_date?: string | null
  transaction_date?: string | null
  remittance_information?: string[] | null
  reference_number?: string | null
  debtor?: { name?: string } | null
}

// --- Endpoints ---

export async function listAspsps(country: string): Promise<Aspsp[]> {
  const data = await call<{ aspsps: Aspsp[] }>('GET', `/aspsps?country=${encodeURIComponent(country)}&service=AIS`)
  return data.aspsps
}

/** Consent length to request: the bank's maximum, else the PSD2 180 days. */
export function consentValidUntil(aspsp: Pick<Aspsp, 'maximum_consent_validity'> | undefined, now: Date = new Date()): Date {
  const seconds = aspsp?.maximum_consent_validity ?? 180 * DAY_S
  // A minute of margin so the bank never sees a value past its own maximum.
  return new Date(now.getTime() + (seconds - 60) * 1000)
}

export async function startAuth(input: {
  aspspName: string
  aspspCountry: string
  psuType: string
  validUntil: Date
  state: string
  redirectUrl: string
}): Promise<{ url: string }> {
  return call('POST', '/auth', {
    access: { valid_until: input.validUntil.toISOString() },
    aspsp: { name: input.aspspName, country: input.aspspCountry },
    state: input.state,
    redirect_url: input.redirectUrl,
    psu_type: input.psuType,
  })
}

export async function createSession(code: string): Promise<{ session_id: string; accounts: SessionAccount[] }> {
  return call('POST', '/sessions', { code })
}

export async function getSession(sessionId: string): Promise<{ status: string; access?: { valid_until?: string } }> {
  return call('GET', `/sessions/${encodeURIComponent(sessionId)}`)
}

export async function deleteSession(sessionId: string): Promise<void> {
  await call('DELETE', `/sessions/${encodeURIComponent(sessionId)}`)
}

/** All transactions since `dateFrom` (YYYY-MM-DD), following continuation keys. */
export async function getTransactions(accountUid: string, dateFrom: string): Promise<EbTransaction[]> {
  const all: EbTransaction[] = []
  let continuationKey: string | undefined
  // Hard stop so a misbehaving bank can't loop us forever.
  for (let page = 0; page < 50; page++) {
    const qs = new URLSearchParams({ date_from: dateFrom })
    if (continuationKey) qs.set('continuation_key', continuationKey)
    const data = await call<{ transactions: EbTransaction[]; continuation_key?: string | null }>(
      'GET',
      `/accounts/${encodeURIComponent(accountUid)}/transactions?${qs}`,
    )
    all.push(...data.transactions)
    if (!data.continuation_key) break
    continuationKey = data.continuation_key
  }
  return all
}
