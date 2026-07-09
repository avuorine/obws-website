import http2 from 'node:http2'
import jwt from 'jsonwebtoken'

/**
 * Sends a contentless Apple Wallet update push so registered devices pull a
 * fresh pass from the PassKit web service. Token-based auth (.p8) — no cert.
 *
 * Env vars:
 *   APPLE_APNS_KEY (base64 of the .p8 PEM), APPLE_APNS_KEY_ID, APPLE_TEAM_ID,
 *   APPLE_PASS_TYPE_ID (used as the APNs topic).
 *
 * Wallet always uses the production APNs host.
 */

const APNS_HOST = 'https://api.push.apple.com'

function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`${name} is not set`)
  return v
}

function providerToken(): string {
  const key = Buffer.from(requireEnv('APPLE_APNS_KEY'), 'base64').toString('utf8')
  return jwt.sign({ iss: requireEnv('APPLE_TEAM_ID') }, key, {
    algorithm: 'ES256',
    keyid: requireEnv('APPLE_APNS_KEY_ID'),
  })
}

/** Best-effort: sends an empty push to each device token. Returns failed tokens. */
export async function sendPassUpdate(pushTokens: string[]): Promise<string[]> {
  if (pushTokens.length === 0) return []

  const token = providerToken()
  const topic = requireEnv('APPLE_PASS_TYPE_ID')
  const client = http2.connect(APNS_HOST)
  const failed: string[] = []

  try {
    await Promise.all(
      pushTokens.map(
        (device) =>
          new Promise<void>((resolve) => {
            const req = client.request({
              ':method': 'POST',
              ':path': `/3/device/${device}`,
              authorization: `bearer ${token}`,
              'apns-topic': topic,
            })
            let status = 0
            req.on('response', (headers) => {
              status = Number(headers[':status']) || 0
            })
            req.on('error', () => {
              failed.push(device)
              resolve()
            })
            req.on('end', () => {
              if (status !== 200) failed.push(device)
              resolve()
            })
            req.setEncoding('utf8')
            req.on('data', () => {})
            req.end('{}')
          }),
      ),
    )
  } finally {
    client.close()
  }

  return failed
}
